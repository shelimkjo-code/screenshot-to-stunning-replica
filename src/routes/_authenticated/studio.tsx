import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Eraser, History, LayoutGrid, Ruler, Sparkles, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { BackgroundPanel } from "@/components/studio/BackgroundPanel";
import { BatchBar } from "@/components/studio/BatchBar";
import { CopiesPanel } from "@/components/studio/CopiesPanel";
import { DownloadPanel } from "@/components/studio/DownloadPanel";
import { EnhancePanel } from "@/components/studio/EnhancePanel";
import { PhotoEditor } from "@/components/studio/PhotoEditor";
import { PreviewPanel } from "@/components/studio/PreviewPanel";
import { SizePanel } from "@/components/studio/SizePanel";
import { UploadPanel } from "@/components/studio/UploadPanel";
import { cn } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";
import { loadJob } from "@/lib/studio/job-loader";
import { scheduleSettingsSave } from "@/lib/studio/processor";
import { useLayout } from "@/lib/studio/use-preview";
import { useStudio } from "@/lib/studio/store";
import { getServiceStatus } from "@/lib/ai.functions";

type Search = { job?: string };

export const Route = createFileRoute("/_authenticated/studio")({
  validateSearch: (s: Record<string, unknown>): Search => (typeof s["job"] === "string" ? { job: s["job"] } : {}),
  head: () => ({
    meta: [
      { title: "Studio — Passport Photo Studio" },
      { name: "description", content: "Upload, process and print passport and stamp photos on A4." },
      { property: "og:title", content: "Studio — Passport Photo Studio" },
      { property: "og:description", content: "Upload, process and print passport and stamp photos on A4." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Studio,
});

const STEPS: { id: string; label: TKey; icon: typeof Upload }[] = [
  { id: "upload", label: "stepUpload", icon: Upload },
  { id: "background", label: "stepBackground", icon: Eraser },
  { id: "enhance", label: "stepEnhance", icon: Sparkles },
  { id: "size", label: "stepSize", icon: Ruler },
  { id: "copies", label: "stepCopies", icon: Copy },
  { id: "preview", label: "stepPreview", icon: LayoutGrid },
  { id: "download", label: "stepDownload", icon: Download },
];

function Studio() {
  const { t, n } = useI18n();
  const search = Route.useSearch();
  const [step, setStep] = useState("upload");
  const [editing, setEditing] = useState<string | null>(null);
  const fetchServices = useServerFn(getServiceStatus);
  const photos = useStudio((s) => s.photos);
  const jobId = useStudio((s) => s.jobId);
  const layout = useLayout();

  useEffect(() => {
    fetchServices()
      .then((s) => useStudio.getState().setServices(s))
      .catch(() => useStudio.getState().setServices({ removeBg: false, replicate: false }));
  }, [fetchServices]);

  useEffect(() => {
    if (search.job && search.job !== useStudio.getState().jobId) {
      loadJob(search.job).catch((e) => toast.error((e as Error).message));
    }
  }, [search.job]);

  useEffect(() => {
    if (!jobId) return;
    scheduleSettingsSave({ photo_count: photos.length, total_copies: layout.totalCopies, page_count: layout.pageCount });
  }, [jobId, photos.length, layout.totalCopies, layout.pageCount]);

  const badge = (id: string) => {
    if (id === "upload" && photos.length) return n(photos.length);
    if (id === "preview" && layout.pageCount) return n(layout.pageCount);
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="mx-auto grid max-w-[1400px] gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[230px_1fr] lg:gap-6 lg:py-6">
        <nav className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                step === s.id ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <span className={cn("grid size-6 place-items-center rounded-md font-mono text-xs", step === s.id ? "bg-primary-foreground/20" : "bg-secondary text-primary")}>{n(i + 1)}</span>
              <s.icon className="size-4" />
              <span className="whitespace-nowrap">{t(s.label)}</span>
              {badge(s.id) && <span className={cn("ml-auto rounded-full px-1.5 font-mono text-[11px]", step === s.id ? "bg-primary-foreground/20" : "bg-secondary")}>{badge(s.id)}</span>}
            </button>
          ))}
          <Link to="/history" className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">
            <span className="grid size-6 place-items-center rounded-md bg-secondary font-mono text-xs text-primary">{n(8)}</span>
            <History className="size-4" />
            <span className="whitespace-nowrap">{t("stepHistory")}</span>
          </Link>
        </nav>
        <main className="min-w-0">
          <BatchBar />
          {step === "upload" && <UploadPanel onEdit={setEditing} />}
          {step === "background" && <BackgroundPanel />}
          {step === "enhance" && <EnhancePanel />}
          {step === "size" && <SizePanel />}
          {step === "copies" && <CopiesPanel />}
          {step === "preview" && <PreviewPanel />}
          {step === "download" && <DownloadPanel />}
        </main>
      </div>
      <PhotoEditor id={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
