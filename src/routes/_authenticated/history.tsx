import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderOpen, Trash2, FileX2, History } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app/AppHeader";
import { Panel } from "@/components/studio/common";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { deleteJobFiles } from "@/lib/studio/processor";
import { useStudio } from "@/lib/studio/store";

const jobsQuery = queryOptions({
  queryKey: ["photo_jobs"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("photo_jobs")
      .select("id, title, photo_count, total_copies, page_count, files_deleted, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Processing history — Passport Photo Studio" },
      { name: "description", content: "Previous passport photo batches, files and print sheets." },
      { property: "og:title", content: "Processing history — Passport Photo Studio" },
      { property: "og:description", content: "Previous passport photo batches, files and print sheets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(jobsQuery),
  component: HistoryPage,
});

function HistoryPage() {
  const { t, n, lang } = useI18n();
  const qc = useQueryClient();
  const { data: jobs } = useSuspenseQuery(jobsQuery);
  const refresh = () => qc.invalidateQueries({ queryKey: jobsQuery.queryKey });

  async function removeFiles(id: string) {
    await deleteJobFiles(id);
    if (useStudio.getState().jobId === id) useStudio.getState().setFilesDeleted(true);
    toast.success(t("filesDeleted"));
    refresh();
  }
  async function removeJob(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    await deleteJobFiles(id).catch(() => undefined);
    await supabase.from("photo_jobs").delete().eq("id", id);
    if (useStudio.getState().jobId === id) useStudio.getState().reset();
    refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-5">
        <Panel title={t("historyTitle")} icon={<History className="size-5" />}>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
          ) : (
            <ul className="divide-y">
              {jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{j.title || j.id.slice(0, 8)}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {new Date(j.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      {" · "}{n(j.photo_count)} {t("photos")} · {n(j.total_copies)} {t("copies")} · {n(j.page_count)} {t("pages")}
                    </p>
                    {j.files_deleted && <p className="text-xs font-medium text-success">{t("filesDeleted")}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!j.files_deleted && (
                      <Button asChild size="sm" variant="soft">
                        <Link to="/studio" search={{ job: j.id }}><FolderOpen />{t("open")}</Link>
                      </Button>
                    )}
                    {!j.files_deleted && (
                      <Button size="sm" variant="outline" onClick={() => void removeFiles(j.id)}><FileX2 />{t("deleteFiles")}</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeJob(j.id)}><Trash2 />{t("deleteBatch")}</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </main>
    </div>
  );
}
