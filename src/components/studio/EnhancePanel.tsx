import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";
import type { EnhanceMode } from "@/lib/studio/imaging";
import { reprocess, scheduleSettingsSave } from "@/lib/studio/processor";
import { useDonePhotos, usePreviewUrl } from "@/lib/studio/use-preview";
import { BG_PRESETS, useStudio } from "@/lib/studio/store";
import { BeforeAfter } from "./BeforeAfter";
import { Panel, ServiceStatus } from "./common";

function Thumb({ id, active, onClick }: { id: string; active: boolean; onClick: () => void }) {
  const photo = useStudio((s) => s.photos.find((p) => p.id === id));
  const settings = useStudio((s) => s.settings);
  const url = usePreviewUrl(photo, settings, "final", 60);
  return (
    <button onClick={onClick} className={cn("w-14 shrink-0 overflow-hidden rounded-md border-2", active ? "border-primary" : "border-transparent")} style={{ aspectRatio: `${settings.widthMm}/${settings.heightMm}` }}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

export function EnhancePanel() {
  const { t } = useI18n();
  const settings = useStudio((s) => s.settings);
  const services = useStudio((s) => s.services);
  const photos = useStudio((s) => s.photos);
  const done = useDonePhotos();
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    if (!sel && done[0]) setSel(done[0].id);
  }, [done, sel]);
  const selected = done.find((p) => p.id === sel) ?? done[0];

  const modes: { id: EnhanceMode; title: TKey; desc: TKey }[] = [
    { id: "chatgpt", title: "modeChatgpt", desc: "modeChatgptDesc" },
    { id: "natural", title: "modeNatural", desc: "modeNaturalDesc" },
    { id: "standard", title: "modeStandard", desc: "modeStandardDesc" },
    { id: "hq", title: "modeHq", desc: "modeHqDesc" },
    { id: "off", title: "modeOff", desc: "modeOffDesc" },
  ];
  return (
    <Panel title={t("stepEnhance")} icon={<Sparkles className="size-5" />}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-5">
          <ServiceStatus which="replicate" />
          {services && !services.replicate && settings.enhanceMode !== "chatgpt" && (
            <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">{t("enhanceNotConnected")}</p>
          )}
          <div>
            <h3 className="mb-2 text-sm font-semibold">{t("enhanceMode")}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    useStudio
                      .getState()
                      .setSettings(m.id === "chatgpt" ? { enhanceMode: m.id, bgColor: BG_PRESETS.blue } : { enhanceMode: m.id });
                    scheduleSettingsSave();
                  }}
                  className={cn(
                    "rounded-xl border bg-card p-3 text-left transition",
                    settings.enhanceMode === m.id ? "border-primary ring-2 ring-primary/25" : "hover:bg-secondary",
                  )}
                >
                  <span className="block font-semibold">{t(m.title)}</span>
                  <span className="text-xs text-muted-foreground">{t(m.desc)}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Button variant="outline" disabled={!photos.length} onClick={() => reprocess(photos.map((p) => p.id), "enhance")}>
              <Sparkles />{t("rerunEnhance")}
            </Button>
          </div>
        </div>
        <div className="rounded-xl border bg-desk p-4">
          <h3 className="mb-3 text-sm font-semibold">{t("beforeAfter")}</h3>
          {selected ? (
            <>
              <BeforeAfter photo={selected} />
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {done.map((p) => <Thumb key={p.id} id={p.id} active={p.id === selected.id} onClick={() => setSel(p.id)} />)}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("pickPhoto")}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
