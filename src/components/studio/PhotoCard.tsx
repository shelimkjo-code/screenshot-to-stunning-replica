import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { usePreviewUrl } from "@/lib/studio/use-preview";
import { useStudio, type PhotoItem, photoAspect } from "@/lib/studio/store";
import { CopiesPicker, StageBadge } from "./common";

function useObjectUrl(b: Blob | null) {
  const [u, setU] = useState<string | null>(null);
  useEffect(() => {
    if (!b) return setU(null);
    const url = URL.createObjectURL(b);
    setU(url);
    return () => URL.revokeObjectURL(url);
  }, [b]);
  return u;
}

export function PhotoCard({ photo, onEdit, onRemove, onRetry, onCopies }: {
  photo: PhotoItem;
  onEdit: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onCopies: (n: number) => void;
}) {
  const { t } = useI18n();
  const settings = useStudio((s) => s.settings);
  const done = photo.stage === "done";
  const finalUrl = usePreviewUrl(done ? photo : undefined, settings, "final", 120);
  const rawUrl = useObjectUrl(done ? null : (photo.work ?? photo.original));
  const busy = !done && photo.stage !== "failed" && photo.stage !== "queued";
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-card">
      <div className="relative checker" style={{ aspectRatio: photoAspect(photo, settings) }}>
        {(finalUrl ?? rawUrl) && (
          <img src={(done ? finalUrl : rawUrl) ?? undefined} alt={photo.fileName} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {busy && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-x-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-primary/25 to-transparent" />
          </div>
        )}
        <div className="absolute left-1.5 top-1.5 rounded-full bg-card/95 shadow-sm"><StageBadge stage={photo.stage} /></div>
        {done && (
          <button onClick={onEdit} className="absolute inset-0 grid place-items-center bg-primary-deep/0 opacity-0 transition group-hover:bg-primary-deep/40 group-hover:opacity-100" aria-label={t("edit")}>
            <span className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1 text-xs font-semibold"><Pencil className="size-3" />{t("edit")}</span>
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <p className="truncate text-xs font-medium" title={photo.fileName}>{photo.fileName}</p>
        {!done && photo.stage !== "failed" && <Progress value={photo.progress} className="h-1.5" />}
        {photo.stage === "failed" && <p className="line-clamp-3 text-[11px] leading-snug text-destructive" title={photo.error ?? ""}>{photo.error}</p>}
        <CopiesPicker size="sm" value={photo.copies} onChange={onCopies} />
        <div className="mt-auto flex gap-1">
          {done && (
            <Button size="sm" variant="soft" className="flex-1" onClick={onEdit}><Pencil />{t("edit")}</Button>
          )}
          {photo.stage === "failed" && (
            <Button size="sm" variant="soft" className="flex-1" onClick={onRetry}><RotateCcw />{t("retry")}</Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={t("remove")}>
            <Trash2 />
          </Button>
        </div>
      </div>
    </article>
  );
}
