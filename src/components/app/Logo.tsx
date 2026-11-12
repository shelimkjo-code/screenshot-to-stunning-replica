import { useI18n } from "@/lib/i18n";

export function Logo() {
  const { t } = useI18n();
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative grid h-9 w-8 place-items-center rounded-md bg-gradient-primary shadow-glow" aria-hidden>
        <span className="absolute inset-[3px] rounded-[4px] border border-primary-foreground/40" />
        <span className="mt-1 h-3 w-3 rounded-full bg-primary-foreground/90" />
        <span className="absolute bottom-[5px] h-2 w-5 rounded-t-full bg-primary-foreground/90" />
      </span>
      <span className="font-display text-base font-bold leading-none tracking-tight text-foreground">{t("appName")}</span>
    </span>
  );
}
