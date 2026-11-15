import { supabase } from "@/integrations/supabase/client";
import { chatgptRestore, geminiEnhance, checkEnhancement, removeBackground, startEnhancement } from "@/lib/ai.functions";
import { removeBackgroundLocal } from "./bg-local";
import { makeWorkingCopy } from "./imaging";
import { useStudio, type PhotoItem, type Settings } from "./store";

const BUCKET = "photos";
const CONCURRENCY = 3;
const running = new Set<string>();
let cachedUid: string | null = null;

class StepError extends Error {}

async function uid(): Promise<string> {
  if (cachedUid) return cachedUid;
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new StepError("Not signed in");
  cachedUid = data.user.id;
  return cachedUid;
}
supabase.auth.onAuthStateChange((e) => {
  if (e === "SIGNED_OUT" || e === "SIGNED_IN") cachedUid = null;
});

function get(id: string) {
  return useStudio.getState().photos.find((p) => p.id === id);
}
function patch(id: string, p: Partial<PhotoItem>) {
  if (get(id)) useStudio.getState().updatePhoto(id, p);
}

let jobPromise: Promise<string> | null = null;
export async function ensureJob(): Promise<string> {
  const st = useStudio.getState();
  if (st.jobId) return st.jobId;
  if (!jobPromise) {
    jobPromise = (async () => {
      const title = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
      const { data, error } = await supabase
        .from("photo_jobs")
        .insert({ title, settings: st.settings as never })
        .select("id")
        .single();
      if (error || !data) throw new StepError(`Could not create batch: ${error?.message}`);
      useStudio.getState().setJob(data.id, title);
      return data.id;
    })().finally(() => {
      jobPromise = null;
    });
  }
  return jobPromise;
}

async function upload(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true });
  if (error) throw new StepError(`Upload failed: ${error.message}`);
}

export async function downloadPath(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new StepError(`Could not download file: ${error?.message ?? "missing"}`);
  return data;
}

async function saveRow(id: string) {
  const p = get(id);
  const jobId = useStudio.getState().jobId;
  if (!p || !jobId) return;
  const row = {
    id: p.id,
    job_id: jobId,
    file_name: p.fileName,
    original_path: p.paths.original ?? null,
    enhanced_path: p.paths.enhanced ?? null,
    cutout_path: p.paths.cutout ?? null,
    status: p.stage,
    enhance_status: p.enhanceStatus,
    bg_status: p.bgStatus,
    error: p.error,
    copies: p.copies,
    edits: { ...p.edits, workPath: p.paths.work ?? null, lowRes: p.lowRes, bgEngineUsed: p.bgEngineUsed } as never,
    sort_order: p.sortOrder,
  };
  const { error } = await supabase.from("job_photos").upsert(row);
  if (!error && !p.saved) useStudio.setState((s) => ({ photos: s.photos.map((x) => (x.id === id ? { ...x, saved: true } : x)) }));
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function scheduleSave(id: string) {
  clearTimeout(saveTimers.get(id));
  saveTimers.set(id, setTimeout(() => void saveRow(id), 800));
}

let settingsTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleSettingsSave(extra?: { photo_count: number; total_copies: number; page_count: number }) {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(async () => {
    const st = useStudio.getState();
    if (!st.jobId) return;
    await supabase
      .from("photo_jobs")
      .update({ settings: st.settings as never, ...(extra ?? {}) })
      .eq("id", st.jobId);
  }, 1000);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolveEngine(s: Settings): "removebg" | "local" {
  // ChatGPT already made the background blue; the free built-in cut-out is only used for framing.
  if (s.enhanceMode === "chatgpt" || s.enhanceMode === "gemini") return "local";
  const services = useStudio.getState().services;
  if (s.bgEngine === "auto") return services?.removeBg ? "removebg" : "local";
  return s.bgEngine;
}

async function processPhoto(id: string) {
  const user = await uid();
  const jobId = await ensureJob();
  const base = `${user}/${jobId}/${id}`;
  let p = get(id);
  if (!p) return;
  const settings = useStudio.getState().settings;
  const services = useStudio.getState().services;

  // 1. Upload original (kept untouched) and a working copy.
  patch(id, { stage: "uploading", progress: 5, error: null });
  if (!p.paths.original && p.original) {
    const ext = (p.fileName.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${base}/original.${ext}`;
    await upload(path, p.original, p.original.type || "image/jpeg");
    patch(id, { paths: { ...get(id)!.paths, original: path } });
  }
  p = get(id)!;
  if (!p.work) {
    const src = p.original ?? (p.paths.original ? await downloadPath(p.paths.original) : null);
    if (!src) throw new StepError("Original photo is missing");
    const work = await makeWorkingCopy(src);
    const path = `${base}/work.jpg`;
    await upload(path, work.blob, "image/jpeg");
    patch(id, { work: work.blob, lowRes: Math.max(work.width, work.height) < 1000, paths: { ...get(id)!.paths, work: path } });
  }
  patch(id, { progress: 20 });
  await saveRow(id);

  // 2. AI face enhancement (Replicate CodeFormer).
  p = get(id)!;
  if (p.enhanceStatus !== "done" && p.enhanceStatus !== "off" && p.enhanceStatus !== "not_connected") {
    if (settings.enhanceMode === "off") {
      patch(id, { enhanceStatus: "off" });
    } else if (settings.enhanceMode === "chatgpt" || settings.enhanceMode === "gemini") {
      patch(id, { stage: "enhancing", enhanceStatus: "running", progress: 30 });
      const args = { sourcePath: p.paths.work!, targetPath: `${base}/enhanced.png` };
      const r =
        settings.enhanceMode === "gemini"
          ? await geminiEnhance({ data: args })
          : await chatgptRestore({ data: { ...args, bgColor: settings.bgColor } });
      if (!r.ok) {
        patch(id, { enhanceStatus: "failed" });
        throw new StepError(r.error);
      }
      const blob = await downloadPath(r.path);
      patch(id, { enhanced: blob, enhanceStatus: "done", paths: { ...get(id)!.paths, enhanced: r.path } });
    } else if (!services?.replicate) {
      patch(id, { enhanceStatus: "not_connected" });
    } else {
      patch(id, { stage: "enhancing", enhanceStatus: "running", progress: 25 });
      const started = await startEnhancement({
        data: { sourcePath: p.paths.work!, mode: settings.enhanceMode, lowRes: p.lowRes },
      });
      if (!started.ok) {
        patch(id, { enhanceStatus: "failed" });
        throw new StepError(started.error);
      }
      const target = `${base}/enhanced.png`;
      let path: string | null = null;
      for (let i = 0; i < 100 && !path; i++) {
        await wait(i < 3 ? 2500 : 4000);
        if (!get(id)) return;
        const r = await checkEnhancement({ data: { predictionId: started.predictionId, targetPath: target } });
        if (r.status === "failed") {
          patch(id, { enhanceStatus: "failed" });
          throw new StepError(r.error);
        }
        if (r.status === "succeeded") path = r.path;
        else patch(id, { progress: Math.min(55, 25 + i * 3) });
      }
      if (!path) {
        patch(id, { enhanceStatus: "failed" });
        throw new StepError("Face enhancement timed out");
      }
      const blob = await downloadPath(path);
      patch(id, { enhanced: blob, enhanceStatus: "done", paths: { ...get(id)!.paths, enhanced: path } });
    }
  }
  patch(id, { progress: 60 });

  // 3. Background removal.
  p = get(id)!;
  if (p.bgStatus !== "done") {
    patch(id, { stage: "removing_bg", bgStatus: "running", progress: 62 });
    const engine = resolveEngine(settings);
    const srcPath = p.paths.enhanced ?? p.paths.work!;
    const srcBlob = p.enhanced ?? p.work!;
    const target = `${base}/cutout.png`;
    if (engine === "removebg") {
      if (!services?.removeBg) {
        patch(id, { bgStatus: "failed" });
        throw new StepError("remove.bg is not connected. Choose Built-in AI or add the remove.bg key.");
      }
      const r = await removeBackground({ data: { sourcePath: srcPath, targetPath: target } });
      if (!r.ok) {
        patch(id, { bgStatus: "failed" });
        throw new StepError(r.error);
      }
      const cut = await downloadPath(r.path);
      patch(id, { cutout: cut, bgStatus: "done", bgEngineUsed: "removebg", paths: { ...get(id)!.paths, cutout: r.path } });
    } else {
      let cut: Blob;
      try {
        cut = await removeBackgroundLocal(srcBlob);
      } catch (e) {
        patch(id, { bgStatus: "failed" });
        throw new StepError(`Built-in AI failed: ${(e as Error).message}`);
      }
      await upload(target, cut, "image/png");
      patch(id, { cutout: cut, bgStatus: "done", bgEngineUsed: "local", paths: { ...get(id)!.paths, cutout: target } });
    }
  }

  patch(id, { stage: "done", progress: 100, error: null });
  await saveRow(id);
}

export function pump() {
  const photos = useStudio.getState().photos;
  for (const p of photos) {
    if (running.size >= CONCURRENCY) break;
    if (p.stage !== "queued" || running.has(p.id)) continue;
    running.add(p.id);
    processPhoto(p.id)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Photo processing failed", msg);
        patch(p.id, { stage: "failed", error: msg });
        void saveRow(p.id);
      })
      .finally(() => {
        running.delete(p.id);
        pump();
      });
  }
}

export function retry(ids: string[]) {
  for (const id of ids) {
    const p = get(id);
    if (!p || p.stage !== "failed") continue;
    patch(id, {
      stage: "queued",
      error: null,
      enhanceStatus: p.enhanceStatus === "failed" ? "pending" : p.enhanceStatus,
      bgStatus: p.bgStatus === "failed" ? "pending" : p.bgStatus,
    });
  }
  pump();
}

/** Redo a stage while keeping everything that came before it. */
export function reprocess(ids: string[], what: "bg" | "enhance") {
  for (const id of ids) {
    const p = get(id);
    if (!p || running.has(id)) continue;
    if (what === "enhance") {
      const { enhanced: _e, cutout: _c, ...rest } = p.paths;
      patch(id, { stage: "queued", error: null, enhanceStatus: "pending", enhanced: null, cutout: null, bgStatus: "pending", paths: rest });
    } else {
      const { cutout: _c, ...rest } = p.paths;
      patch(id, { stage: "queued", error: null, cutout: null, bgStatus: "pending", paths: rest });
    }
  }
  pump();
}

export async function deletePhotoFiles(p: PhotoItem) {
  const paths = Object.values(p.paths).filter((x): x is string => Boolean(x));
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  await supabase.from("job_photos").delete().eq("id", p.id);
}

/** Remove every stored file of a batch (keeps the history record). */
export async function deleteJobFiles(jobId: string) {
  const user = await uid();
  const prefix = `${user}/${jobId}`;
  const { data: dirs } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  const all: string[] = [];
  for (const d of dirs ?? []) {
    const { data: files } = await supabase.storage.from(BUCKET).list(`${prefix}/${d.name}`, { limit: 100 });
    for (const f of files ?? []) all.push(`${prefix}/${d.name}/${f.name}`);
  }
  for (let i = 0; i < all.length; i += 100) await supabase.storage.from(BUCKET).remove(all.slice(i, i + 100));
  await supabase.from("photo_jobs").update({ files_deleted: true }).eq("id", jobId);
  await supabase
    .from("job_photos")
    .update({ original_path: null, enhanced_path: null, cutout_path: null })
    .eq("job_id", jobId);
}
