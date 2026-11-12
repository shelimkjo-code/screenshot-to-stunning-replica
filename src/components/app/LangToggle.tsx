import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <Button variant="ghost" size="sm" onClick={() => setLang(lang === "bn" ? "en" : "bn")} aria-label="Change language">
      <Languages />
      {t("language")}
    </Button>
  );
}
