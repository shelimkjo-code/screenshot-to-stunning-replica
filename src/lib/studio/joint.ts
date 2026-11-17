import { detectFaces } from "./face";

function toFile(c: HTMLCanvasElement) {
  return new Promise<File>((r, j) =>
    c.toBlob((x) => (x ? r(new File([x], `joint_${Date.now()}.jpg`, { type: "image/jpeg" })) : j(new Error("joint failed"))), "image/jpeg", 0.95),
  );
}

/**
 * Builds one joint photo from two separate photos: faces are found, both people are scaled to the same
 * face size and placed side by side at the same height. Falls back to equal-height placement.
 */
export async function combineJoint(a: File, b: File): Promise<File> {
  const [ia, ib] = await Promise.all([createImageBitmap(a), createImageBitmap(b)]);
  const [fa, fb] = await Promise.all([detectFaces(ia).catch(() => []), detectFaces(ib).catch(() => [])]);
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  if (fa[0] && fb[0]) {
    const A = fa[0];
    const B = fb[0];
    // Common face height in the output, never upscaling the smaller face too much.
    const T = Math.min(Math.max(A.h, B.h), 2400 / 5.6, Math.min(A.h, B.h) * 1.25);
    const half = 2.8 * T;
    c.width = Math.round(half * 2);
    c.height = Math.round(4.6 * T);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    const place = (img: ImageBitmap, f: { x: number; y: number; w: number; h: number }, cx: number, clipX: number) => {
      const k = T / f.h;
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, 0, half, c.height);
      ctx.clip();
      const dx = cx - (f.x + f.w / 2) * k;
      const dy = 1.2 * T - f.y * k;
      ctx.drawImage(img, dx, dy, img.width * k, img.height * k);
      ctx.restore();
    };
    place(ia, A, half * 0.55, 0);
    place(ib, B, half * 1.45, half);
    return toFile(c);
  }

  const h = Math.min(2000, Math.max(ia.height, ib.height));
  const wa = Math.round((ia.width * h) / ia.height);
  const wb = Math.round((ib.width * h) / ib.height);
  c.width = wa + wb;
  c.height = h;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(ia, 0, 0, wa, h);
  ctx.drawImage(ib, wa, 0, wb, h);
  return toFile(c);
}
