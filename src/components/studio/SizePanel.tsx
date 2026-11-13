import { Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { SIZE_PRESETS } from "@/lib/studio/layout";
import { scheduleSettingsSave } from "@/lib/studio/processor";
import { useLayout } from "@/lib/studio/use-preview";
import { useStudio, type Settings } from "@/lib/studio/store";
import { Panel, Stat } from "./common";

export function SizePanel() {
  const { t, n } = useI18n();
  const s = useStudio((st) => st.settings);
  const layout = useLayout();
  const set = (p: Partial<Settings>) => {
    useStudio.getState().setSettings(p);
    scheduleSettingsSave();
  };
  const presets = [
    { id: "passport" as const, label: t("passport"), ...SIZE_PRESETS.passport },
    { id: "stamp" as const, label: t("stamp"), ...SIZE_PRESETS.stamp },
  ];
  const cm = (mm: number) => Math.round(mm) / 10;
  return (
    <Panel title={t("stepSize")} icon={<Ruler className="size-5" />}>
      <div className="grid gap-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => set({ sizePreset: p.id, widthMm: p.widthMm, heightMm: p.heightMm })}
              className={cn("flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition", s.sizePreset === p.id ? "border-primary ring-2 ring-primary/25" : "hover:bg-secondary")}
            >
              <span className="grid place-items-center rounded border-2 border-primary/50 bg-secondary" style={{ width: p.widthMm * 0.9, height: p.heightMm * 0.9 }} />
              <span>
                <span className="block font-semibold">{p.label}</span>
                <span className="font-mono text-sm text-muted-foreground">{n(cm(p.widthMm))} × {n(cm(p.heightMm))} cm</span>
              </span>
            </button>
          ))}
          <button
            onClick={() => set({ sizePreset: "custom" })}
            className={cn("rounded-xl border bg-card p-4 text-left transition", s.sizePreset === "custom" ? "border-primary ring-2 ring-primary/25" : "hover:bg-secondary")}
          >
            <span className="block font-semibold">{t("customSize")}</span>
            <span className="font-mono text-sm text-muted-foreground">{n(cm(s.widthMm))} × {n(cm(s.heightMm))} cm</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumField label={t("widthCm")} value={s.widthMm / 10} step={0.1} min={1} max={20} onChange={(v) => set({ sizePreset: "custom", widthMm: Math.round(v * 10 * 10) / 10 })} />
          <NumField label={t("heightCm")} value={s.heightMm / 10} step={0.1} min={1} max={28} onChange={(v) => set({ sizePreset: "custom", heightMm: Math.round(v * 10 * 10) / 10 })} />
          <NumField label={t("marginMm")} value={s.marginMm} step={0.5} min={0} max={30} onChange={(v) => set({ marginMm: v })} />
          <NumField label={t("gapMm")} value={s.gapMm} step={0.5} min={0} max={20} onChange={(v) => set({ gapMm: v })} />
        </div>

        {layout.perPage === 0 ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{t("layoutNoFit")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t("perRow")} value={n(layout.columns)} />
            <Stat label={t("rowsPerPage")} value={n(layout.rows)} />
            <Stat label={t("perPage")} value={n(layout.perPage)} />
          </div>
        )}
      </div>
    </Panel>
  );
}

function NumField({ label, value, onChange, step, min, max }: { label: string; value: number; onChange: (v: number) => void; step: number; min: number; max: number }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={Number(value.toFixed(2))}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
        }}
        className="h-11 font-mono"
      />
    </div>
  );
}
