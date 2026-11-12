import { useEffect, useMemo, useState } from "react";
import { canvasToBlob } from "./imaging";
import { computeLayout } from "./layout";
import { renderBefore, renderFinal } from "./render-cache";
import { frameKey, useStudio, type PhotoItem, type Settings } from "./store";

const blobIds = new WeakMap<Blob, number>();
let nextBlobId = 1;
function bid(b: Blob | null) {
  if (!b) return 0;
  let id = blobIds.get(b);
  if (!id) {
    id = nextBlobId++;
    blobIds.set(b, id);
  }
  return id;
}

export function visualKey(p: PhotoItem, s: Settings, kind: string, dpi: number) {
  return [p.id, kind, dpi, bid(p.cutout), bid(p.enhanced), bid(p.work), bid(p.original), JSON.stringify(p.edits), frameKey(s)].join("|");
}

const cache = new Map<string, { key: string; promise: Promise<string | null>; url?: string }>();

export function previewUrl(p: PhotoItem, s: Settings, kind: "final" | "before", dpi: number): Promise<string | null> {
  const slot = `${p.id}:${kind}:${dpi}`;
  const key = visualKey(p, s, kind, dpi);
  const hit = cache.get(slot);
  if (hit && hit.key === key) return hit.promise;
  if (hit?.url) {
    const old = hit.url;
    setTimeout(() => URL.revokeObjectURL(old), 5000);
  }
  const entry: { key: string; promise: Promise<string | null>; url?: string } = { key, promise: Promise.resolve(null) };
  entry.promise = (async () => {
    const c = kind === "final" ? await renderFinal(p, s, dpi) : await renderBefore(p, s, dpi);
    if (!c) return null;
    const b = await canvasToBlob(c, "image/jpeg", 0.9);
    const url = URL.createObjectURL(b);
    entry.url = url;
    return url;
  })().catch((e) => {
    console.error("Preview render failed", e);
    return null;
  });
  cache.set(slot, entry);
  return entry.promise;
}

export function usePreviewUrl(p: PhotoItem | undefined, s: Settings, kind: "final" | "before" = "final", dpi = 150) {
  const [url, setUrl] = useState<string | null>(null);
  const key = p ? visualKey(p, s, kind, dpi) : "";
  useEffect(() => {
    if (!p) return;
    let alive = true;
    previewUrl(p, s, kind, dpi).then((u) => alive && u && setUrl(u));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}

export function usePreviewUrls(photos: PhotoItem[], s: Settings, dpi = 150) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = photos.map((p) => visualKey(p, s, "final", dpi)).join("#");
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const p of photos) {
        const u = await previewUrl(p, s, "final", dpi);
        if (!alive) return;
        if (u) setUrls((prev) => (prev[p.id] === u ? prev : { ...prev, [p.id]: u }));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

export function useDonePhotos() {
  const photos = useStudio((s) => s.photos);
  return useMemo(() => photos.filter((p) => p.stage === "done" && (p.cutout || p.work)), [photos]);
}

export function useLayout() {
  const done = useDonePhotos();
  const s = useStudio((st) => st.settings);
  return useMemo(
    () =>
      computeLayout({
        photoWidthMm: s.widthMm,
        photoHeightMm: s.heightMm,
        marginMm: s.marginMm,
        gapMm: s.gapMm,
        items: done.map((p) => ({ id: p.id, copies: p.copies })),
      }),
    [done, s.widthMm, s.heightMm, s.marginMm, s.gapMm],
  );
}
