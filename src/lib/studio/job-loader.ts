import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_EDITS, type Edits } from "./imaging";
import { SIZE_PRESETS } from "./layout";
import { downloadPath } from "./processor";
import { DEFAULT_SETTINGS, useStudio, type PhotoItem, type PhotoKind, type Settings, type Stage, type StepStatus } from "./store";

export async function loadJob(jobId: string) {
  const { data: job, error } = await supabase.from("photo_jobs").select("*").eq("id", jobId).single();
  if (error || !job) throw new Error(error?.message ?? "Batch not found");
  const { data: rows } = await supabase.from("job_photos").select("*").eq("job_id", jobId).order("sort_order");

  const photos: PhotoItem[] = await Promise.all(
    (rows ?? []).map(async (r) => {
      const extra = (r.edits ?? {}) as Partial<Edits> & { workPath?: string | null; lowRes?: boolean; bgEngineUsed?: "removebg" | "local" | null; kind?: PhotoKind };
      const { workPath, lowRes, bgEngineUsed, kind, ...editFields } = extra;
      const paths: PhotoItem["paths"] = {};
      if (r.original_path) paths.original = r.original_path;
      if (workPath && !job.files_deleted) paths.work = workPath;
      if (r.enhanced_path) paths.enhanced = r.enhanced_path;
      if (r.cutout_path) paths.cutout = r.cutout_path;
      const safe = async (p?: string) => (p ? downloadPath(p).catch(() => null) : null);
      const [work, enhanced, cutout] = await Promise.all([safe(paths.work), safe(paths.enhanced), safe(paths.cutout)]);
      const done = r.status === "done" && cutout;
      const item: PhotoItem = {
        id: r.id,
        kind: kind === "joint" ? "joint" : "single",
        fileName: r.file_name,
        original: null,
        work,
        enhanced,
        cutout,
        paths,
        stage: (done ? "done" : "failed") as Stage,
        progress: done ? 100 : 0,
        error: done ? null : job.files_deleted ? "Files were deleted" : (r.error ?? "Processing was interrupted"),
        enhanceStatus: r.enhance_status as StepStatus,
        bgStatus: (cutout ? "done" : "pending") as StepStatus,
        bgEngineUsed: bgEngineUsed ?? null,
        lowRes: Boolean(lowRes),
        copies: r.copies,
        edits: { ...DEFAULT_EDITS, ...editFields },
        version: 0,
        saved: true,
        sortOrder: r.sort_order,
      };
      return item;
    }),
  );

  useStudio.getState().replaceAll({
    jobId,
    jobTitle: job.title,
    photos,
    settings: normalizeSettings({ ...DEFAULT_SETTINGS, ...((job.settings ?? {}) as Partial<Settings>) }),
    filesDeleted: job.files_deleted,
  });
}

/** Older batches saved the previous stamp size; presets always use today's size. */
function normalizeSettings(s: Settings): Settings {
  if (s.sizePreset === "stamp" || s.sizePreset === "passport") return { ...s, ...SIZE_PRESETS[s.sizePreset] };
  return s;
}
