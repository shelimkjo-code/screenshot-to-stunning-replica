/** Browser-side image work: framing, adjustments and exact-size rendering. */
export type Rotation = 0 | 90 | 180 | 270;
export type EnhanceMode = "off" | "natural" | "standard" | "hq" | "chatgpt";

export interface Edits {
  rotation: Rotation;
  tilt: number; // degrees, -15..15
  zoom: number; // multiplier, 0.5..2.5
  offsetX: number; // % of frame width
  offsetY: number; // % of frame height
  brightness: number; // -50..50
  contrast: number; // -50..50
  saturation: number; // -100..100
  sharpness: number; // 0..100
  bgColor: string | null; // null = use batch colour
}

export const DEFAULT_EDITS: Edits = {
  rotation: 0,
  tilt: 0,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpness: 0,
  bgColor: null,
};

export interface SubjectAnalysis {
  crownY: number;
  centerX: number;
  headH: number;
}

const bitmapCache = new WeakMap<Blob, Promise<ImageBitmap>>();
export function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  let p = bitmapCache.get(blob);
  if (!p) {
    p = createImageBitmap(blob);
    bitmapCache.set(blob, p);
  }
  return p;
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement) {
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  return ctx;
}

/** Returns a canvas with the image rotated by a multiple of 90 degrees. */
export function rotateSource(src: ImageBitmap | HTMLCanvasElement, rotation: Rotation): HTMLCanvasElement {
  const sw = src.width;
  const sh = src.height;
  const swap = rotation === 90 || rotation === 270;
  const c = makeCanvas(swap ? sh : sw, swap ? sw : sh);
  const ctx = ctx2d(c);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(src, -sw / 2, -sh / 2);
  return c;
}

/** Downscale a large image for processing (keeps aspect ratio). */
export async function makeWorkingCopy(file: Blob, maxEdge = 2048): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = makeCanvas(bmp.width * k, bmp.height * k);
  const ctx = ctx2d(c);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await canvasToBlob(c, "image/jpeg", 0.95);
  return { blob, width: c.width, height: c.height };
}

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), type, quality),
  );
}

/** Finds crown, head centre and head height from the cut-out's alpha channel. */
export function analyzeSubject(src: CanvasImageSource & { width: number; height: number }): SubjectAnalysis | null {
  const sw = src.width;
  const sh = src.height;
  const scale = Math.min(1, 420 / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  ctx.drawImage(src, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const widths = new Float32Array(h);
  const left = new Int32Array(h).fill(-1);
  const right = new Int32Array(h).fill(-1);
  let transparent = 0;
  for (let y = 0; y < h; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3]!;
      if (a < 20) transparent++;
      if (a > 128) {
        if (l < 0) l = x;
        r = x;
      }
    }
    left[y] = l;
    right[y] = r;
    widths[y] = l >= 0 ? r - l + 1 : 0;
  }
  // An opaque image has no usable mask.
  if (transparent < w * h * 0.03) return null;

  const minW = Math.max(3, w * 0.02);
  let y0 = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    if (widths[y]! >= minW) {
      if (y0 < 0) y0 = y;
      bottom = y;
    }
  }
  if (y0 < 0) return null;

  const smooth = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    let s = 0;
    let n = 0;
    for (let k = -3; k <= 3; k++) {
      const yy = y + k;
      if (yy >= 0 && yy < h) {
        s += widths[yy]!;
        n++;
      }
    }
    smooth[y] = s / n;
  }

  let peak = 0;
  let neckY = -1;
  const startGuard = h * 0.04;
  for (let y = y0; y <= bottom; y++) {
    const wd = smooth[y]!;
    if (wd > peak) peak = wd;
    if (y - y0 > startGuard && wd < peak * 0.82) {
      let minY = y;
      let minWd = wd;
      for (let yy = y; yy <= bottom && yy < y + h * 0.2; yy++) {
        if (smooth[yy]! < minWd) {
          minWd = smooth[yy]!;
          minY = yy;
        }
        if (smooth[yy]! > peak) break;
      }
      neckY = minY;
      break;
    }
  }

  let headTop = 0;
  for (let y = y0; y < Math.min(bottom, y0 + h * 0.18); y++) headTop = Math.max(headTop, smooth[y]!);

  let headH: number;
  if (neckY > 0) {
    headH = (neckY - y0) * 1.0;
    const ratio = headH / Math.max(1, peak);
    if (ratio < 0.9 || ratio > 1.9) headH = headTop * 1.3;
  } else {
    headH = headTop * 1.3;
  }
  headH = Math.min(Math.max(headH, h * 0.12), h * 0.85);

  let cxSum = 0;
  let cxN = 0;
  for (let y = y0; y < Math.min(bottom, y0 + headH); y++) {
    if (left[y]! >= 0) {
      cxSum += (left[y]! + right[y]!) / 2;
      cxN++;
    }
  }
  const centerX = cxN ? cxSum / cxN : w / 2;
  return { crownY: y0 / scale, centerX: centerX / scale, headH: headH / scale };
}

export interface FrameSpec {
  /** Head height (crown→chin) as a fraction of the photo height. */
  headFrac: number;
  /** Space above the crown as a fraction of the photo height. */
  crownFrac: number;
}
export const PASSPORT_FRAME: FrameSpec = { headFrac: 0.56, crownFrac: 0.1 };
export const STAMP_FRAME: FrameSpec = { headFrac: 0.53, crownFrac: 0.1 };

export interface RenderOptions {
  source: CanvasImageSource & { width: number; height: number };
  analysis: SubjectAnalysis | null;
  outW: number;
  outH: number;
  background: string | null; // null = keep transparent
  edits: Edits;
  mode: EnhanceMode;
  frame: FrameSpec;
  adjust: boolean; // false renders the untouched "before" view
}

export function renderPhoto(o: RenderOptions): HTMLCanvasElement {
  const layer = makeCanvas(o.outW, o.outH);
  const lctx = ctx2d(layer);
  lctx.imageSmoothingEnabled = true;
  lctx.imageSmoothingQuality = "high";

  const sw = o.source.width;
  const sh = o.source.height;
  let k: number;
  let ax: number;
  let ay: number;
  let dx: number;
  let dy: number;
  if (o.analysis) {
    k = (o.frame.headFrac * o.outH) / o.analysis.headH;
    ax = o.analysis.centerX;
    ay = o.analysis.crownY;
    dx = o.outW / 2;
    dy = o.frame.crownFrac * o.outH;
  } else {
    k = Math.max(o.outW / sw, o.outH / sh);
    ax = sw / 2;
    ay = sh / 2;
    dx = o.outW / 2;
    dy = o.outH / 2;
  }
  k *= o.edits.zoom;
  dx += (o.edits.offsetX / 100) * o.outW;
  dy += (o.edits.offsetY / 100) * o.outH;

  lctx.save();
  lctx.translate(dx, dy);
  lctx.rotate((o.edits.tilt * Math.PI) / 180);
  lctx.scale(k, k);
  lctx.drawImage(o.source, -ax, -ay, sw, sh);
  lctx.restore();

  if (o.adjust) {
    const img = lctx.getImageData(0, 0, layer.width, layer.height);
    applyAdjustments(img, o.mode, o.edits);
    lctx.putImageData(img, 0, 0);
  }

  if (!o.background) return layer;
  const out = makeCanvas(o.outW, o.outH);
  const octx = ctx2d(out);
  octx.fillStyle = o.background;
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(layer, 0, 0);
  return out;
}

const MODE_PARAMS: Record<EnhanceMode, { levels: number; sat: number; sharpen: number }> = {
  off: { levels: 0, sat: 1, sharpen: 0 },
  natural: { levels: 0.35, sat: 1.0, sharpen: 0.3 },
  standard: { levels: 0.55, sat: 1.04, sharpen: 0.45 },
  hq: { levels: 0.65, sat: 1.05, sharpen: 0.55 },
  chatgpt: { levels: 0, sat: 1, sharpen: 0 },
};

/** Natural tone correction: gentle auto-levels, user sliders, unsharp-mask sharpening. */
export function applyAdjustments(img: ImageData, mode: EnhanceMode, e: Edits) {
  const d = img.data;
  const n = d.length / 4;
  const p = MODE_PARAMS[mode];

  // Per-channel levels from subject pixels only.
  const lo = [0, 0, 0];
  const hi = [255, 255, 255];
  if (p.levels > 0) {
    const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (d[i * 4 + 3]! > 200) {
        hist[0]![d[i * 4]!]!++;
        hist[1]![d[i * 4 + 1]!]!++;
        hist[2]![d[i * 4 + 2]!]!++;
        count++;
      }
    }
    if (count > 100) {
      for (let ch = 0; ch < 3; ch++) {
        const h = hist[ch]!;
        let acc = 0;
        let l = 0;
        while (l < 255 && acc + h[l]! < count * 0.005) acc += h[l++]!;
        acc = 0;
        let r = 255;
        while (r > 0 && acc + h[r]! < count * 0.005) acc += h[r--]!;
        if (r - l < 60) {
          const mid = (l + r) / 2;
          l = Math.max(0, mid - 30);
          r = Math.min(255, mid + 30);
        }
        lo[ch] = l;
        hi[ch] = r;
      }
    }
  }

  const b = e.brightness * 1.2;
  const c = e.contrast * 2.55;
  const cf = (259 * (c + 255)) / (255 * (259 - c));
  const sat = p.sat * (1 + e.saturation / 100);
  const lut: Uint8ClampedArray[] = [0, 1, 2].map((ch) => {
    const t = new Uint8ClampedArray(256);
    const range = Math.max(1, hi[ch]! - lo[ch]!);
    for (let v = 0; v < 256; v++) {
      let x = v + (((v - lo[ch]!) * 255) / range - v) * p.levels;
      x = cf * (x - 128) + 128 + b;
      t[v] = x;
    }
    return t;
  });

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] === 0) continue;
    let r = lut[0]![d[o]!]!;
    let g = lut[1]![d[o + 1]!]!;
    let bl = lut[2]![d[o + 2]!]!;
    if (sat !== 1) {
      const l = 0.299 * r + 0.587 * g + 0.114 * bl;
      r = l + (r - l) * sat;
      g = l + (g - l) * sat;
      bl = l + (bl - l) * sat;
    }
    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = bl;
  }

  const amount = p.sharpen + (e.sharpness / 100) * 1.2;
  if (amount > 0.01) unsharp(img, amount);
}

function unsharp(img: ImageData, amount: number) {
  const { width: w, height: h, data: d } = img;
  const src = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const o = (y * w + x) * 4;
      if (src[o + 3]! < 10) continue;
      for (let ch = 0; ch < 3; ch++) {
        const i = o + ch;
        const blur =
          (src[i - w * 4 - 4]! + 2 * src[i - w * 4]! + src[i - w * 4 + 4]! +
            2 * src[i - 4]! + 4 * src[i]! + 2 * src[i + 4]! +
            src[i + w * 4 - 4]! + 2 * src[i + w * 4]! + src[i + w * 4 + 4]!) / 16;
        d[i] = src[i]! + (src[i]! - blur) * amount;
      }
    }
  }
}

/** Mark a canvas JPEG as 300 DPI in its JFIF header so print apps keep the physical size. */
export async function jpegWithDpi(c: HTMLCanvasElement, dpi = 300, quality = 0.95): Promise<Blob> {
  const blob = await canvasToBlob(c, "image/jpeg", quality);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes[2] === 0xff && bytes[3] === 0xe0 && String.fromCharCode(...bytes.slice(6, 10)) === "JFIF") {
    bytes[13] = 1;
    bytes[14] = (dpi >> 8) & 0xff;
    bytes[15] = dpi & 0xff;
    bytes[16] = (dpi >> 8) & 0xff;
    bytes[17] = dpi & 0xff;
  }
  return new Blob([bytes], { type: "image/jpeg" });
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Add a pHYs chunk so the PNG carries its 300 DPI physical size. */
export async function pngWithDpi(c: HTMLCanvasElement, dpi = 300): Promise<Blob> {
  const blob = await canvasToBlob(c, "image/png");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.slice(4, 17)));
  const ihdrEnd = 33;
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.slice(0, ihdrEnd), 0);
  out.set(chunk, ihdrEnd);
  out.set(bytes.slice(ihdrEnd), ihdrEnd + chunk.length);
  return new Blob([out], { type: "image/png" });
}
