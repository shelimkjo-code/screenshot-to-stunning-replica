/** Free in-browser face detection (MediaPipe BlazeFace). Loaded lazily so it never runs during SSR. */
import type { FaceDetector } from "@mediapipe/tasks-vision";

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

const VERSION = "1.2.3";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODELS = {
  full: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/latest/blaze_face_full_range.tflite",
  short: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite",
} as const;

const detectors = new Map<keyof typeof MODELS, Promise<FaceDetector | null>>();

function getDetector(kind: keyof typeof MODELS): Promise<FaceDetector | null> {
  let d = detectors.get(kind);
  if (!d) {
    d = (async () => {
      try {
        const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const files = await FilesetResolver.forVisionTasks(WASM);
        return await FaceDetector.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODELS[kind], delegate: "CPU" },
          runningMode: "IMAGE",
          minDetectionConfidence: 0.5,
        });
      } catch (e) {
        console.warn("Face detector unavailable", kind, e);
        detectors.delete(kind);
        return null;
      }
    })();
    detectors.set(kind, d);
  }
  return d;
}

type Src = CanvasImageSource & { width: number; height: number };

/** Draws the image (scaled) onto an opaque white canvas so cut-outs detect like normal photos. */
function toCanvas(src: Src, sx = 0, sy = 0, sw = src.width, sh = src.height, maxEdge = 1024) {
  const k = Math.min(1, maxEdge / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * k));
  c.height = Math.max(1, Math.round(sh * k));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { c, k };
}

async function run(kind: keyof typeof MODELS, src: Src, sx: number, sy: number, sw: number, sh: number): Promise<FaceBox[]> {
  const det = await getDetector(kind);
  if (!det) return [];
  const { c, k } = toCanvas(src, sx, sy, sw, sh);
  const res = det.detect(c);
  return res.detections
    .filter((d) => d.boundingBox)
    .map((d) => {
      const b = d.boundingBox!;
      return { x: sx + b.originX / k, y: sy + b.originY / k, w: b.width / k, h: b.height / k, score: d.categories[0]?.score ?? 0 };
    });
}

/** Removes overlapping duplicates, keeps the bigger box. */
function dedupe(boxes: FaceBox[]): FaceBox[] {
  const sorted = [...boxes].sort((a, b) => b.w * b.h - a.w * a.h);
  const out: FaceBox[] = [];
  for (const b of sorted) {
    const overlaps = out.some((o) => {
      const ix = Math.max(0, Math.min(o.x + o.w, b.x + b.w) - Math.max(o.x, b.x));
      const iy = Math.max(0, Math.min(o.y + o.h, b.y + b.h) - Math.max(o.y, b.y));
      return ix * iy > 0.3 * Math.min(o.w * o.h, b.w * b.h);
    });
    if (!overlaps) out.push(b);
  }
  return out;
}

/**
 * Finds faces, biggest first. Tries the whole picture, then the upper part
 * (full-body photos have small faces), with both detector models.
 */
export async function detectFaces(src: Src): Promise<FaceBox[]> {
  const W = src.width;
  const H = src.height;
  const passes: [keyof typeof MODELS, number, number, number, number][] = [
    ["full", 0, 0, W, H],
    ["short", 0, 0, W, H],
    ["full", 0, 0, W, Math.min(H, W * 1.1)],
    ["short", W * 0.15, 0, W * 0.7, Math.min(H * 0.5, W * 0.7)],
  ];
  for (const [kind, sx, sy, sw, sh] of passes) {
    try {
      const found = dedupe(await run(kind, src, sx, sy, sw, sh)).filter((b) => b.w > W * 0.02);
      if (found.length) return found;
    } catch (e) {
      console.warn("Face detection pass failed", e);
    }
  }
  return [];
}

/** Keeps the main faces: the biggest one, plus others of similar size (for joint photos). */
export function mainFaces(faces: FaceBox[], max: number): FaceBox[] {
  if (!faces.length) return [];
  const big = faces[0]!.h;
  return faces
    .filter((f) => f.h >= big * 0.55)
    .slice(0, max)
    .sort((a, b) => a.x - b.x);
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Head-and-shoulders region around the faces, used to crop before background removal. */
export function smartCropRect(faces: FaceBox[], imgW: number, imgH: number): Rect | null {
  if (!faces.length) return null;
  const fh = faces.reduce((s, f) => s + f.h, 0) / faces.length;
  const x0 = Math.min(...faces.map((f) => f.x));
  const x1 = Math.max(...faces.map((f) => f.x + f.w));
  const y0 = Math.min(...faces.map((f) => f.y));
  const y1 = Math.max(...faces.map((f) => f.y + f.h));
  const left = Math.max(0, x0 - 1.4 * fh);
  const right = Math.min(imgW, x1 + 1.4 * fh);
  const top = Math.max(0, y0 - 1.1 * fh);
  const bottom = Math.min(imgH, y1 + 2.3 * fh);
  const r = { x: Math.round(left), y: Math.round(top), w: Math.round(right - left), h: Math.round(bottom - top) };
  // Not worth cropping when the photo is already a close head-and-shoulders shot.
  if (r.w * r.h > imgW * imgH * 0.85) return null;
  return r;
}
