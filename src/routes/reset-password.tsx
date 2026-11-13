import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Passport Photo Studio" },
      { name: "description", content: "Set a new password for your studio account." },
      { property: "og:title", content: "Reset password — Passport Photo Studio" },
      { property: "og:description", content: "Set a new password for your studio account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("OK");
    navigate({ to: "/studio" });
  }
  return (
    <div className="min-h-screen bg-hero px-4 py-10">
      <div className="mx-auto max-w-md">
        <Logo />
        <form onSubmit={save} className="mt-8 grid gap-4 rounded-2xl border bg-card p-6 shadow-sheet">
          <Label htmlFor="np">{t("newPassword")}</Label>
          <Input id="np" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
          <Button type="submit" variant="hero" size="lg" disabled={busy}>{t("savePassword")}</Button>
        </form>
      </div>
    </div>
  );
}
