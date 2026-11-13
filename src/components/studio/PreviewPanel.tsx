import { ChevronLeft, ChevronRight, Info, LayoutGrid, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useDonePhotos, useLayout, usePreviewUrls } from "@/lib/studio/use-preview";
import { useStudio } from "@/lib/studio/store";
import { A4Sheet } from "./A4Sheet";
import { Panel, Stat } from "./common";

export function PrintNote() {
  const { t } = useI18n();
  return (
    <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-warning-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      {t("printNote")}
    </p>
  );
}

export function PreviewPanel() {
  const { t, n } = useI18n();
  const settings = useStudio((s) => s.settings);
  const done = useDonePhotos();
  const layout = useLayout();
  const urls = usePreviewUrls(done, settings, 100);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (page > Math.max(0, layout.pageCount - 1)) setPage(Math.max(0, layout.pageCount - 1));
  }, [layout.pageCount, page]);
  const label = `${n(settings.widthMm)}×${n(settings.heightMm)} mm`;

  return (
    <Panel title={t("stepPreview")} icon={<LayoutGrid className="size-5" />}>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={t("size")} value={label} />
        <Stat label={t("grid")} value={`${n(layout.columns)} × ${n(layout.rows)}`} />
        <Stat label={t("totalCopies")} value={n(layout.totalCopies)} />
        <Stat label={t("pages")} value={n(layout.pageCount)} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Zoom out"><Minus /></Button>
          <span className="w-12 text-center font-mono text-sm">{n(Math.round(zoom * 100))}%</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoom in"><Plus /></Button>
        </div>
        {layout.pageCount > 1 && (
          <div className="ml-auto flex items-center gap-1 rounded-lg border bg-card p-1">
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="px-1 text-sm">{t("page")} {n(page + 1)} {t("of")} {n(layout.pageCount)}</span>
            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={page >= layout.pageCount - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight /></Button>
          </div>
        )}
      </div>
      <div className="bg-desk max-h-[75vh] overflow-auto rounded-xl border p-4 sm:p-8">
        {layout.pageCount === 0 ? (
          <div className="relative">
            <A4Sheet page={[]} urls={{}} zoom={zoom} />
            <p className="absolute inset-0 grid place-items-center px-8 text-center text-sm text-muted-foreground">{t("previewEmpty")}</p>
          </div>
        ) : (
          <A4Sheet page={layout.pages[page] ?? []} urls={urls} zoom={zoom} showLabel label={label} />
        )}
      </div>
      <div className="mt-4"><PrintNote /></div>
    </Panel>
  );
}
