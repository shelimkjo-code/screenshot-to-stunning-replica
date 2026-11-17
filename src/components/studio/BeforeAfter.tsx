import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { usePreviewUrl } from "@/lib/studio/use-preview";
import { useStudio, type PhotoItem, photoAspect } from "@/lib/studio/store";

export function BeforeAfter({ photo, dpi = 200 }: { photo: PhotoItem; dpi?: number }) {
  const { t } = useI18n();
  const settings = useStudio((s) => s.settings);
  const after = usePreviewUrl(photo, settings, "final", dpi);
  const before = usePreviewUrl(photo, settings, "before", dpi);
  const [pos, setPos] = useState(50);
  return (
    <div className="relative mx-auto w-full max-w-[320px] select-none overflow-hidden rounded-lg border shadow-sheet checker" style={{ aspectRatio: photoAspect(photo, settings) }}>
      {after && <img src={after} alt={t("after")} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      {before && (
        <img src={before} alt={t("before")} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} draggable={false} />
      )}
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary-foreground shadow" style={{ left: `${pos}%` }}>
        <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-2 py-1 font-mono text-[10px] font-bold text-primary-foreground shadow-glow">⇆</span>
      </div>
      <span className="absolute left-2 top-2 rounded bg-foreground/70 px-1.5 py-0.5 text-[10px] font-semibold text-background">{t("before")}</span>
      <span className="absolute right-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{t("after")}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={t("beforeAfter")}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
