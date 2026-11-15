import { Cpu, Eraser, Sparkle, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";
import { reprocess, scheduleSettingsSave } from "@/lib/studio/processor";
import { useStudio, type BgEngine } from "@/lib/studio/store";
import { ColorSwatches, Panel, ServiceStatus } from "./common";

export function BackgroundPanel() {
  const { t } = useI18n();
  const settings = useStudio((s) => s.settings);
  const photos = useStudio((s) => s.photos);
  const set = (p: Partial<typeof settings>) => {
    useStudio.getState().setSettings(p);
    scheduleSettingsSave();
  };
  const engines: { id: BgEngine; title: TKey; desc: TKey; icon: typeof Wand2 }[] = [
    { id: "auto", title: "engineAuto", desc: "engineAutoDesc", icon: Sparkle },
    { id: "removebg", title: "engineRemoveBg", desc: "engineRemoveBgDesc", icon: Wand2 },
    { id: "local", title: "engineLocal", desc: "engineLocalDesc", icon: Cpu },
  ];
  return (
    <Panel title={t("stepBackground")} icon={<Eraser className="size-5" />}>
      {false as boolean ? (
        <p className="rounded-lg bg-secondary p-3 text-sm text-secondary-foreground">{t("bgLockedChatgpt")}</p>
      ) : (
      <div className="grid gap-6">
        <ServiceStatus which="removeBg" />
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("bgEngine")}</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {engines.map((e) => (
              <button
                key={e.id}
                onClick={() => set({ bgEngine: e.id })}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition",
                  settings.bgEngine === e.id ? "border-primary ring-2 ring-primary/25" : "hover:bg-secondary",
                )}
              >
                <e.icon className="size-5 text-primary" />
                <span className="font-semibold">{t(e.title)}</span>
                <span className="text-xs text-muted-foreground">{t(e.desc)}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("bgColor")}</h3>
          <ColorSwatches value={settings.bgColor} onChange={(c) => set({ bgColor: c })} />
        </div>
        <div>
          <Button variant="outline" disabled={!photos.length} onClick={() => reprocess(photos.map((p) => p.id), "bg")}>
            <Wand2 />{t("reprocessAllBg")}
          </Button>
        </div>
      </div>
      )}
    </Panel>
  );
}
