async function load(f: File) {
  const url = URL.createObjectURL(f);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Places two photos side by side at the same height so the normal cut-out/crop flow treats them as one joint photo. */
export async function combineJoint(a: File, b: File): Promise<File> {
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const h = Math.min(2000, Math.max(ia.naturalHeight, ib.naturalHeight));
  const wa = Math.round((ia.naturalWidth * h) / ia.naturalHeight);
  const wb = Math.round((ib.naturalWidth * h) / ib.naturalHeight);
  const c = document.createElement("canvas");
  c.width = wa + wb;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(ia, 0, 0, wa, h);
  ctx.drawImage(ib, wa, 0, wb, h);
  const blob = await new Promise<Blob>((r, j) => c.toBlob((x) => (x ? r(x) : j(new Error("joint failed"))), "image/jpeg", 0.95));
  return new File([blob], `joint_${Date.now()}.jpg`, { type: "image/jpeg" });
}
