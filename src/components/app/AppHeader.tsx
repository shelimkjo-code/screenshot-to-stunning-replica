import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { History, LogOut, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "./LangToggle";
import { Logo } from "./Logo";

export function AppHeader() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const link = "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground";
  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2.5 sm:px-5">
        <Link to="/studio" className="mr-2 shrink-0"><Logo /></Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link to="/studio" className={link} activeProps={{ className: "bg-secondary text-foreground" }}>
            <ScanFace className="size-4" /><span className="hidden sm:inline">{t("studio")}</span>
          </Link>
          <Link to="/history" className={link} activeProps={{ className: "bg-secondary text-foreground" }}>
            <History className="size-4" /><span className="hidden sm:inline">{t("history")}</span>
          </Link>
          <LangToggle />
          <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("signOut")} title={t("signOut")}>
            <LogOut />
          </Button>
        </nav>
      </div>
    </header>
  );
}
