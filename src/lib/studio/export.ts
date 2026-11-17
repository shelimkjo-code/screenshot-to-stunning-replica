import { jpegWithDpi, makeCanvas, pngWithDpi } from "./imaging";
import { A4, mmToPx, PRINT_DPI, type LayoutResult, type PlacedPhoto } from "./layout";
import { renderFinal } from "./render-cache";
import { photoSize, type PhotoItem, type Settings } from "./store";

export async function renderAll(photos: PhotoItem[], s: Settings) {
  const out = new Map<string, HTMLCanvasElement>();
  for (const p of photos) {
    const c = await renderFinal(p, s, PRINT_DPI);
    if (c) out.set(p.id, c);
  }
  return out;
}

export async function buildPdf(layout: LayoutResult, canvases: Map<string, HTMLCanvasElement>): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const dataUrls = new Map<string, string>();
  for (const [id, c] of canvases) dataUrls.set(id, c.toDataURL("image/jpeg", 0.96));
  layout.pages.forEach((page, i) => {
    if (i > 0) pdf.addPage("a4", "portrait");
    for (const pl of page) {
      const url = dataUrls.get(pl.id);
      if (!url) continue;
      // Same alias for every copy embeds each photo only once.
      pdf.addImage(url, "JPEG", pl.xMm, pl.yMm, pl.widthMm, pl.heightMm, `photo-${pl.id}`, "NONE");
    }
  });
  pdf.setProperties({ title: "A4 passport photo sheet", creator: "Passport Photo Studio" });
  return pdf.output("blob");
}

export async function buildPagePng(page: PlacedPhoto[], canvases: Map<string, HTMLCanvasElement>): Promise<Blob> {
  const c = makeCanvas(mmToPx(A4.widthMm), mmToPx(A4.heightMm));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = "high";
  for (const pl of page) {
    const img = canvases.get(pl.id);
    if (!img) continue;
    const x = Math.round((pl.xMm / 25.4) * PRINT_DPI);
    const y = Math.round((pl.yMm / 25.4) * PRINT_DPI);
    ctx.drawImage(img, x, y, mmToPx(pl.widthMm), mmToPx(pl.heightMm));
  }
  return pngWithDpi(c, PRINT_DPI);
}

export async function buildZip(photos: PhotoItem[], canvases: Map<string, HTMLCanvasElement>, s: Settings): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  let i = 1;
  for (const p of photos) {
    const c = canvases.get(p.id);
    if (!c) continue;
    zip.file(photoFileName(p, s, i++), await jpegWithDpi(c));
  }
  return zip.generateAsync({ type: "blob" });
}

export function photoFileName(p: PhotoItem, s: Settings, index: number) {
  const base = p.fileName.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_").slice(0, 40) || "photo";
  return `${String(index).padStart(3, "0")}_${base}_${photoSize(p, s).widthMm}x${photoSize(p, s).heightMm}mm_300dpi.jpg`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function printPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
  };
  document.body.appendChild(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120_000);
}
