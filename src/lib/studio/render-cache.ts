import {
  analyzeSubject,
  loadBitmap,
  makeCanvas,
  PASSPORT_FRAME,
  renderPhoto,
  rotateSource,
  STAMP_FRAME,
  type SubjectAnalysis,
} from "./imaging";
import { mmToPx } from "./layout";
import type { PhotoItem, Settings } from "./store";

interface Prepared {
  source: HTMLCanvasElement;
  analysis: SubjectAnalysis | null;
}
const prepared = new Map<string, { blob: Blob; rotation: number; value: Promise<Prepared> }>();
const beforePrepared = new Map<string, { blob: Blob; rotation: number; w: number; h: number; value: Promise<HTMLCanvasElement> }>();

function mainBlob(p: PhotoItem): Blob | null {
  return p.cutout ?? p.enhanced ?? p.work ?? p.original;
}

export function prepare(p: PhotoItem): Promise<Prepared> | null {
  const blob = mainBlob(p);
  if (!blob) return null;
  const hit = prepared.get(p.id);
  if (hit && hit.blob === blob && hit.rotation === p.edits.rotation) return hit.value;
  const value = (async () => {
    const bmp = await loadBitmap(blob);
    const source = rotateSource(bmp, p.edits.rotation);
    const analysis = p.cutout ? analyzeSubject(source) : null;
    return { source, analysis };
  })();
  prepared.set(p.id, { blob, rotation: p.edits.rotation, value });
  return value;
}

export function frameFor(s: Settings) {
  return s.sizePreset === "stamp" ? STAMP_FRAME : PASSPORT_FRAME;
}

/** Final photo at exact pixel size for the chosen physical size and DPI. */
export async function renderFinal(p: PhotoItem, s: Settings, dpi = 300): Promise<HTMLCanvasElement | null> {
  const prep = prepare(p);
  if (!prep) return null;
  const { source, analysis } = await prep;
  return renderPhoto({
    source,
    analysis,
    outW: mmToPx(s.widthMm, dpi),
    outH: mmToPx(s.heightMm, dpi),
    background: p.cutout ? (p.edits.bgColor ?? s.bgColor) : null,
    edits: p.edits,
    mode: s.enhanceMode,
    frame: frameFor(s),
    adjust: true,
  });
}

/** The untouched original framed exactly like the final photo (for before/after). */
export async function renderBefore(p: PhotoItem, s: Settings, dpi = 300): Promise<HTMLCanvasElement | null> {
  const prep = prepare(p);
  const raw = p.work ?? p.original;
  if (!prep || !raw) return null;
  const { source, analysis } = await prep;
  let entry = beforePrepared.get(p.id);
  if (!entry || entry.blob !== raw || entry.rotation !== p.edits.rotation || entry.w !== source.width || entry.h !== source.height) {
    const value = (async () => {
      const bmp = await loadBitmap(raw);
      const rotated = rotateSource(bmp, p.edits.rotation);
      const c = makeCanvas(source.width, source.height);
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(rotated, 0, 0, c.width, c.height);
      return c;
    })();
    entry = { blob: raw, rotation: p.edits.rotation, w: source.width, h: source.height, value };
    beforePrepared.set(p.id, entry);
  }
  const before = await entry.value;
  return renderPhoto({
    source: before,
    analysis,
    outW: mmToPx(s.widthMm, dpi),
    outH: mmToPx(s.heightMm, dpi),
    background: null,
    edits: { ...p.edits, brightness: 0, contrast: 0, saturation: 0, sharpness: 0 },
    mode: "off",
    frame: frameFor(s),
    adjust: false,
  });
}

export function forget(id: string) {
  prepared.delete(id);
  beforePrepared.delete(id);
}
