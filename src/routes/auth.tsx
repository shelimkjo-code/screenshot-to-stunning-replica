import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/app/LangToggle";
import { Logo } from "@/components/app/Logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useI18n } from "@/lib/i18n";

type Search = { redirect?: string };

function safeRedirect(r?: string) {
  if (!r) return "/studio";
  try {
    const u = new URL(r, window.location.origin);
    if (u.origin !== window.location.origin) return "/studio";
    const path = u.pathname + u.search;
    return path.startsWith("/auth") ? "/studio" : path;
  } catch {
    return "/studio";
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => (typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
  head: () => ({
    meta: [
      { title: "Staff sign in — Passport Photo Studio" },
      { name: "description", content: "Sign in to the passport and stamp photo studio." },
      { property: "og:title", content: "Staff sign in — Passport Photo Studio" },
      { property: "og:description", content: "Sign in to the passport and stamp photo studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const GoogleLogo = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.480-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.070 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: safeRedirect(search.redirect), replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_IN" && session) navigate({ to: safeRedirect(search.redirect), replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, search.redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/studio" },
        });
        if (error) throw error;
        if (!data.session) toast.success(t("checkEmail"));
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success(t("resetSent"));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "lovable") {
    sessionStorage.setItem("postAuth", safeRedirect(search.redirect));
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(String((r.error as Error).message ?? r.error));
  }

  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/"><Logo /></Link>
        <LangToggle />
      </header>
      <main className="mx-auto flex max-w-md flex-col px-4 pb-16 pt-6">
        <div className="crop-marks rounded-2xl border bg-card p-6 shadow-sheet sm:p-8">
          <h1 className="text-2xl font-bold">{mode === "signup" ? t("signUp") : mode === "forgot" ? t("forgot") : t("signIn")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("privacyNote")}</p>

          {mode !== "forgot" && (
            <div className="mt-6 grid gap-3">
              <button type="button" onClick={() => oauth("google")} className="btn-google flex h-11 w-full items-center justify-center gap-[10px] rounded-lg px-3 text-sm">
                <GoogleLogo />
                {t("continueGoogle")}
              </button>
              <button type="button" className="lovable-auth-button" onClick={() => oauth("lovable")}>
                Continue with Lovable
              </button>
              <div className="my-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {t("or")}
                <span className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <form onSubmit={submit} className="mt-2 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            </div>
            {mode !== "forgot" && (
              <div className="grid gap-1.5">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
              </div>
            )}
            <Button type="submit" variant="hero" size="lg" disabled={busy}>
              {mode === "signup" ? t("signUp") : mode === "forgot" ? t("savePassword").replace(/.*/, t("forgot")) : t("signIn")}
            </Button>
          </form>

          <div className="mt-5 flex flex-col gap-2 text-sm">
            {mode === "signin" && (
              <>
                <button className="text-left text-primary hover:underline" onClick={() => setMode("forgot")}>{t("forgot")}</button>
                <button className="text-left text-primary hover:underline" onClick={() => setMode("signup")}>{t("noAccount")}</button>
              </>
            )}
            {mode !== "signin" && (
              <button className="text-left text-primary hover:underline" onClick={() => setMode("signin")}>{t("haveAccount")}</button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
