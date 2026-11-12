import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Crop, Layers, Printer, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import heroImg from "@/assets/studio-hero.jpg";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/app/LangToggle";
import { Logo } from "@/components/app/Logo";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Passport Photo Studio — AI passport & stamp photo maker" },
      { name: "description", content: "Batch passport and stamp photos with AI background removal, natural face enhancement and exact A4 300 DPI print sheets." },
      { property: "og:title", content: "Passport Photo Studio — AI passport & stamp photo maker" },
      { property: "og:description", content: "Batch passport and stamp photos with AI background removal and exact A4 print sheets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useI18n();
  const features = [
    { icon: Layers, bn: "একসাথে ১০০+ ছবি", en: "100+ photos per batch" },
    { icon: Wand2, bn: "AI ব্যাকগ্রাউন্ড রিমুভ", en: "AI background removal" },
    { icon: Sparkles, bn: "ন্যাচারাল ফেস এনহ্যান্সমেন্ট", en: "Natural face enhancement" },
    { icon: Crop, bn: "৪×৫ ও ২.৫×৩.৫ সেমি নিখুঁত মাপ", en: "Exact 4×5 & 2.5×3.5 cm" },
    { icon: Printer, bn: "A4 PDF, ৩০০ DPI", en: "A4 PDF at 300 DPI" },
    { icon: ShieldCheck, bn: "গোপন ও নিরাপদ স্টোরেজ", en: "Private, secure storage" },
  ];
  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <LangToggle />
      </header>
      <main className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-12">
        <section className="animate-rise">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
            40 × 50 mm · 25 × 35 mm · A4 · 300 DPI
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.1] text-foreground sm:text-5xl">
            {lang === "bn" ? (
              <>দোকানের জন্য <span className="text-primary">প্রফেশনাল</span> পাসপোর্ট ছবি, এক ক্লিকে</>
            ) : (
              <><span className="text-primary">Professional</span> passport photos for your shop, in one click</>
            )}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">{t("tagline")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="xl">
              <Link to="/studio">
                {t("openStudio")} <ArrowRight />
              </Link>
            </Button>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {features.map((f) => (
              <li key={f.en} className="flex items-center gap-2 rounded-lg border bg-card/80 px-3 py-2.5 text-sm shadow-card">
                <f.icon className="size-4 shrink-0 text-primary" />
                <span>{lang === "bn" ? f.bn : f.en}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">{t("privacyNote")}</p>
        </section>
        <section className="crop-marks animate-rise">
          <img
            src={heroImg}
            alt={lang === "bn" ? "A4 শিটে সাজানো পাসপোর্ট ছবি" : "Passport photos arranged on an A4 sheet"}
            width={1280}
            height={960}
            className="w-full rounded-2xl border object-cover shadow-sheet"
          />
        </section>
      </main>
    </div>
  );
}
