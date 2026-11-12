import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";
import { COPY_OPTIONS } from "@/lib/studio/layout";
import { BG_PRESETS, useStudio, type Stage } from "@/lib/studio/store";

export function Panel({ title, icon, actions, children, className }: { title: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("animate-rise rounded-2xl border bg-card p-4 shadow-card sm:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {icon && <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">{icon}</span>}
        <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
        {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

const STAGE_KEY: Record<Stage, TKey> = {
  queued: "queued",
  uploading: "uploading",
  enhancing: "enhancing",
  removing_bg: "removingBg",
  finishing: "finishing",
  done: "done",
  failed: "failed",
};

export function StageBadge({ stage }: { stage: Stage }) {
  const { t } = useI18n();
  const cls =
    stage === "done"
      ? "bg-success/12 text-success"
      : stage === "failed"
        ? "bg-destructive/10 text-destructive"
        : stage === "queued"
          ? "bg-muted text-muted-foreground"
          : "bg-secondary text-primary";
  const Icon = stage === "done" ? CheckCircle2 : stage === "failed" ? XCircle : stage === "queued" ? CircleDashed : Loader2;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>
      <Icon className={cn("size-3", stage !== "done" && stage !== "failed" && stage !== "queued" && "animate-spin")} />
      {t(STAGE_KEY[stage])}
    </span>
  );
}

export function ServiceStatus({ which }: { which: "removeBg" | "replicate" }) {
  const { t } = useI18n();
  const services = useStudio((s) => s.services);
  const ok = services?.[which];
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border p-3", ok ? "border-success/30 bg-success/5" : "border-warning/40 bg-warning/10")}>
      {ok ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <AlertTriangle className="mt-0.5 size-5 text-warning-foreground" />}
      <div className="text-sm">
        <p className="font-semibold">{t(which === "removeBg" ? "removeBgService" : "replicateService")}</p>
        <p className="text-muted-foreground">
          {services === null ? "…" : ok ? t("connected") : `${t("notConnected")} · ${t("needsKey")}`}
        </p>
      </div>
    </div>
  );
}

export function CopiesPicker({ value, onChange, size = "md" }: { value: number; onChange: (n: number) => void; size?: "sm" | "md" }) {
  const { t, n } = useI18n();
  const isCustom = !(COPY_OPTIONS as readonly number[]).includes(value);
  const btn = size === "sm" ? "h-7 min-w-7 px-1.5 text-xs" : "h-9 min-w-9 px-2.5 text-sm";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COPY_OPTIONS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "rounded-md border font-mono font-semibold transition-colors",
            btn,
            value === c ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
          )}
        >
          {n(c)}
        </button>
      ))}
      <label className={cn("flex items-center gap-1 rounded-md border px-1.5", isCustom && "border-primary bg-secondary", size === "sm" ? "h-7" : "h-9")}>
        <span className="text-xs text-muted-foreground">{t("customCopies")}</span>
        <input
          type="number"
          min={1}
          max={200}
          value={value}
          onChange={(e) => onChange(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
          className="w-12 bg-transparent font-mono text-sm outline-none"
        />
      </label>
    </div>
  );
}

export function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const { t } = useI18n();
  const opts: { key: TKey; color: string }[] = [
    { key: "blue", color: BG_PRESETS.blue },
    { key: "lightBlue", color: BG_PRESETS.lightBlue },
    { key: "white", color: BG_PRESETS.white },
  ];
  const isCustom = !opts.some((o) => o.color.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.color)}
          className={cn(
            "flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium transition",
            value.toLowerCase() === o.color ? "border-primary ring-2 ring-primary/30" : "hover:bg-secondary",
          )}
        >
          <span className="size-6 rounded-md border" style={{ backgroundColor: o.color }} />
          {t(o.key)}
        </button>
      ))}
      <label className={cn("flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium", isCustom && "border-primary ring-2 ring-primary/30")}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" />
        {t("custom")}
      </label>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono text-base font-semibold">{value}</p>
    </div>
  );
}
