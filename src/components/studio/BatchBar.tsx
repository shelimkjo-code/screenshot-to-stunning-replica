import { FilePlus2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { retry } from "@/lib/studio/processor";
import { useStudio } from "@/lib/studio/store";

export function BatchBar() {
  const { t, n } = useI18n();
  const photos = useStudio((s) => s.photos);
  if (!photos.length) return null;
  const done = photos.filter((p) => p.stage === "done").length;
  const failed = photos.filter((p) => p.stage === "failed");
  const total = photos.reduce((s, p) => s + p.progress, 0) / photos.length;
  const busy = photos.length - done - failed.length;
  return (
    <div className="mb-4 rounded-2xl border bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm font-semibold">{t("batchProgress")}</span>
        <span className="font-mono text-sm text-muted-foreground">
          {n(done)}/{n(photos.length)} {t("done")}
          {busy > 0 && <> · {n(busy)} {t("processing")}</>}
          {failed.length > 0 && <span className="text-destructive"> · {n(failed.length)} {t("failed")}</span>}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {failed.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => retry(failed.map((p) => p.id))}><RotateCcw />{t("retryFailed")}</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => useStudio.getState().reset()} disabled={busy > 0}>
            <FilePlus2 />{t("newBatch")}
          </Button>
        </div>
      </div>
      <Progress value={total} className="mt-3 h-2" />
    </div>
  );
}
