import { MessageCircle, Download, FileArchive, FileImage, FileText, Loader2, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendToWhatsApp, useWhatsApp } from "@/lib/studio/whatsapp";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { buildPagePng, buildPdf, buildZip, downloadBlob, photoFileName, printPdf, renderAll } from "@/lib/studio/export";
import { jpegWithDpi } from "@/lib/studio/imaging";
import { renderFinal } from "@/lib/studio/render-cache";
import { deleteJobFiles, scheduleSettingsSave } from "@/lib/studio/processor";
import { useDonePhotos, useLayout, usePreviewUrl } from "@/lib/studio/use-preview";
import { useStudio, type PhotoItem, photoAspect } from "@/lib/studio/store";
import { Panel } from "./common";
import { PrintNote } from "./PreviewPanel";

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function OneRow({ p, index }: { p: PhotoItem; index: number }) {
  const { t } = useI18n();
  const settings = useStudio((s) => s.settings);
  const url = usePreviewUrl(p, settings, "final", 60);
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="w-9 shrink-0 overflow-hidden rounded border" style={{ aspectRatio: photoAspect(p, settings) }}>
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{p.fileName}</span>
      <Button
        size="sm"
        variant="soft"
        onClick={async () => {
          const c = await renderFinal(p, settings, 300);
          if (c) downloadBlob(await jpegWithDpi(c), photoFileName(p, settings, index));
        }}
      >
        <Download />{t("downloadOne")}
      </Button>
    </li>
  );
}

export function DownloadPanel() {
  const { t } = useI18n();
  const settings = useStudio((s) => s.settings);
  const jobId = useStudio((s) => s.jobId);
  const filesDeleted = useStudio((s) => s.filesDeleted);
  const done = useDonePhotos();
  const layout = useLayout();
  const [busy, setBusy] = useState<string | null>(null);
  const disabled = !done.length || layout.pageCount === 0 || busy !== null;

  const wa = useWhatsApp();

  async function run(kind: "pdf" | "png" | "zip" | "print" | "wa") {
    if (kind === "wa" && !wa.number.trim()) return void toast.error(t("waNeedNumber"));
    setBusy(kind);
    try {
      const canvases = await renderAll(done, settings);
      const name = `${settings.sizePreset}_A4_${stamp()}`;
      if (kind === "pdf" || kind === "print" || kind === "wa") {
        const pdf = await buildPdf(layout, canvases);
        if (kind === "print") printPdf(pdf);
        else if (kind === "wa") await sendToWhatsApp(wa.number, new File([pdf], `${name}.pdf`, { type: "application/pdf" }), t("waMessage"), downloadBlob);
        else {
          downloadBlob(pdf, `${name}.pdf`);
          if (settings.autoDelete && jobId && !filesDeleted) {
            await deleteJobFiles(jobId);
            useStudio.getState().setFilesDeleted(true);
            toast.success(t("filesDeleted"));
          }
        }
      } else if (kind === "png") {
        if (layout.pageCount === 1) {
          downloadBlob(await buildPagePng(layout.pages[0]!, canvases), `${name}.png`);
        } else {
          const { default: JSZip } = await import("jszip");
          const zip = new JSZip();
          for (let i = 0; i < layout.pages.length; i++) zip.file(`${name}_page${i + 1}.png`, await buildPagePng(layout.pages[i]!, canvases));
          downloadBlob(await zip.generateAsync({ type: "blob" }), `${name}_pages.zip`);
        }
      } else {
        downloadBlob(await buildZip(done, canvases, settings), `${name}_photos.zip`);
      }
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const icon = (k: string, I: typeof Download) => (busy === k ? <Loader2 className="animate-spin" /> : <I />);
  return (
    <Panel title={t("stepDownload")} icon={<Printer className="size-5" />}>
      <div className="grid gap-5">
        <PrintNote />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="hero" size="xl" disabled={disabled} onClick={() => run("pdf")}>{icon("pdf", FileText)}{busy === "pdf" ? t("preparing") : t("downloadPdf")}</Button>
          <Button variant="success" size="xl" disabled={disabled} onClick={() => run("print")}>{icon("print", Printer)}{t("print")}</Button>
          <Button variant="outline" size="lg" disabled={disabled} onClick={() => run("png")}>{icon("png", FileImage)}{t("downloadPng")}</Button>
          <Button variant="outline" size="lg" disabled={disabled} onClick={() => run("zip")}>{icon("zip", FileArchive)}{t("downloadZip")}</Button>
        </div>
        <div id="whatsapp-send" className="grid gap-2 rounded-xl border p-3">
          <label className="text-sm font-semibold" htmlFor="wa-number">{t("waNumber")}</label>
          <div className="flex gap-2">
            <Input id="wa-number" type="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={wa.number} onChange={(e) => wa.setNumber(e.target.value)} />
            <Button variant="success" disabled={disabled} onClick={() => run("wa")}>{icon("wa", MessageCircle)}{t("waSend")}</Button>
          </div>
          <span className="text-xs text-muted-foreground">{t("waNumberHint")}</span>
        </div>
        <label className="flex items-start gap-3 rounded-xl border p-3">
          <Switch
            checked={settings.autoDelete}
            onCheckedChange={(v) => {
              useStudio.getState().setSettings({ autoDelete: v });
              scheduleSettingsSave();
            }}
          />
          <span>
            <span className="block text-sm font-semibold">{t("autoDelete")}</span>
            <span className="text-xs text-muted-foreground">{t("autoDeleteDesc")}</span>
          </span>
        </label>
        {filesDeleted && <p className="text-sm font-medium text-success">{t("filesDeleted")}</p>}
        {done.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-semibold">{t("individualPhotos")}</h3>
            <ul className="divide-y">{done.map((p, i) => <OneRow key={p.id} p={p} index={i + 1} />)}</ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
