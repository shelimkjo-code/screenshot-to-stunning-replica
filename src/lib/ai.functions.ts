import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { editImage, generateChatCompletion, GatewayError } from "@lovable.dev/ai-gateway";

const BUCKET = "photos";
const REPLICATE_GW = "https://connector-gateway.lovable.dev/replicate/v1";
const CODEFORMER_FALLBACK_VERSION = "7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db53142edd9d2cd56";

export type EnhanceMode = "natural" | "standard" | "hq";

function assertOwnPath(path: string, userId: string) {
  if (typeof path !== "string" || !path.startsWith(`${userId}/`) || path.includes("..")) {
    throw new Error("Invalid file path");
  }
}

function replicateHeaders(): Record<string, string> | null {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const replicateKey = process.env["LOVABLE_CONNECTOR_REPLICATE_API_KEY"];
  if (!lovableKey || !replicateKey) return null;
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": replicateKey };
}

export const getServiceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      removeBg: Boolean(process.env["REMOVE_BG_API_KEY"]),
      replicate: replicateHeaders() !== null,
    };
  });

/** remove.bg: downloads the private source file, removes the background, stores the PNG cutout. */
export const removeBackground = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourcePath: string; targetPath: string }) => input)
  .handler(async ({ data, context }) => {
    assertOwnPath(data.sourcePath, context.userId);
    assertOwnPath(data.targetPath, context.userId);
    const apiKey = process.env["REMOVE_BG_API_KEY"];
    if (!apiKey) return { ok: false as const, code: "not_connected", error: "remove.bg API key is not set up yet." };

    const { data: file, error: dlErr } = await context.supabase.storage.from(BUCKET).download(data.sourcePath);
    if (dlErr || !file) return { ok: false as const, code: "storage", error: `Could not read photo: ${dlErr?.message ?? "missing"}` };

    const form = new FormData();
    form.append("image_file", file, "photo.jpg");
    form.append("size", "full");
    form.append("type", "person");
    form.append("format", "png");
    form.append("crop", "false");

    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`remove.bg failed [${res.status}]: ${body}`);
      let msg = body;
      try {
        const j = JSON.parse(body) as { errors?: { title?: string }[] };
        msg = j.errors?.map((e) => e.title).filter(Boolean).join("; ") || body;
      } catch {
        /* keep raw body */
      }
      const code = res.status === 402 ? "no_credits" : res.status === 403 ? "bad_key" : res.status === 429 ? "rate_limit" : "api_error";
      return { ok: false as const, code, error: `remove.bg [${res.status}]: ${msg}` };
    }
    const png = new Uint8Array(await res.arrayBuffer());
    const { error: upErr } = await context.supabase.storage
      .from(BUCKET)
      .upload(data.targetPath, png, { contentType: "image/png", upsert: true });
    if (upErr) return { ok: false as const, code: "storage", error: `Could not save result: ${upErr.message}` };
    return { ok: true as const, path: data.targetPath };
  });

async function codeformerVersion(headers: Record<string, string>): Promise<string> {
  try {
    const r = await fetch(`${REPLICATE_GW}/models/sczhou/codeformer`, { headers });
    if (r.ok) {
      const j = (await r.json()) as { latest_version?: { id?: string } };
      if (j.latest_version?.id) return j.latest_version.id;
    }
  } catch {
    /* fall back */
  }
  return CODEFORMER_FALLBACK_VERSION;
}

/** Starts a CodeFormer face-restoration prediction for a stored photo. */
export const startEnhancement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourcePath: string; mode: EnhanceMode; lowRes: boolean }) => input)
  .handler(async ({ data, context }) => {
    assertOwnPath(data.sourcePath, context.userId);
    const headers = replicateHeaders();
    if (!headers) return { ok: false as const, code: "not_connected", error: "Replicate is not connected yet." };

    const { data: file, error: dlErr } = await context.supabase.storage.from(BUCKET).download(data.sourcePath);
    if (dlErr || !file) return { ok: false as const, code: "storage", error: `Could not read photo: ${dlErr?.message ?? "missing"}` };

    const form = new FormData();
    form.append("content", file, "photo.jpg");
    const up = await fetch(`${REPLICATE_GW}/files`, { method: "POST", headers, body: form });
    if (!up.ok) {
      const body = await up.text();
      console.error(`Replicate upload failed [${up.status}]: ${body}`);
      if (up.status === 402) return { ok: false as const, code: "no_credits", error: "Replicate account has no credit. Add billing at replicate.com/account/billing." };
      return { ok: false as const, code: "api_error", error: `Replicate upload [${up.status}]: ${body}` };
    }
    const uploaded = (await up.json()) as { urls?: { get?: string } };
    const imageUrl = uploaded.urls?.get;
    if (!imageUrl) return { ok: false as const, code: "api_error", error: "Replicate did not return a file URL." };

    // Higher fidelity keeps the person's identity; lower values restore more aggressively.
    const fidelity = data.mode === "natural" ? 0.9 : data.mode === "standard" ? 0.75 : 0.6;
    const upscale = data.lowRes || data.mode === "hq" ? 2 : 1;
    const version = await codeformerVersion(headers);

    const res = await fetch(`${REPLICATE_GW}/predictions`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        input: {
          image: imageUrl,
          codeformer_fidelity: fidelity,
          upscale,
          face_upsample: data.mode !== "natural",
          background_enhance: false,
        },
      }),
    });
    if (res.status === 402) {
      return { ok: false as const, code: "no_credits", error: "Replicate account has no credit. Add billing at replicate.com/account/billing." };
    }
    if (!res.ok) {
      const body = await res.text();
      console.error(`Replicate prediction failed [${res.status}]: ${body}`);
      return { ok: false as const, code: "api_error", error: `Replicate [${res.status}]: ${body}` };
    }
    const pred = (await res.json()) as { id: string };
    return { ok: true as const, predictionId: pred.id };
  });

/** Polls a prediction; when finished, stores the restored image in private storage. */
export const checkEnhancement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { predictionId: string; targetPath: string }) => input)
  .handler(async ({ data, context }) => {
    assertOwnPath(data.targetPath, context.userId);
    if (!/^[a-z0-9]+$/i.test(data.predictionId)) throw new Error("Invalid prediction id");
    const headers = replicateHeaders();
    if (!headers) return { status: "failed" as const, error: "Replicate is not connected." };

    const r = await fetch(`${REPLICATE_GW}/predictions/${data.predictionId}`, { headers });
    if (!r.ok) {
      const body = await r.text();
      return { status: "failed" as const, error: `Replicate [${r.status}]: ${body}` };
    }
    const pred = (await r.json()) as { status: string; output?: string | string[] | null; error?: string | null };
    if (pred.status === "failed" || pred.status === "canceled") {
      return { status: "failed" as const, error: pred.error ?? `Prediction ${pred.status}` };
    }
    if (pred.status !== "succeeded") return { status: "running" as const };

    const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    if (!out) return { status: "failed" as const, error: "Replicate returned no image." };
    const img = await fetch(out);
    if (!img.ok) return { status: "failed" as const, error: `Could not download result [${img.status}]` };
    const buf = new Uint8Array(await img.arrayBuffer());
    const { error: upErr } = await context.supabase.storage
      .from(BUCKET)
      .upload(data.targetPath, buf, { contentType: img.headers.get("content-type") ?? "image/png", upsert: true });
    if (upErr) return { status: "failed" as const, error: `Could not save result: ${upErr.message}` };
    return { status: "succeeded" as const, path: data.targetPath };
  });

const chatgptPrompt = (bg: string) =>
  `Restore this photo. Replace the background with a plain, solid, even color ${bg}.`;

const GEMINI_PROMPT = `Professionally enhance and retouch this photo while keeping the original image completely unchanged in appearance and identity.

MOST IMPORTANT INSTRUCTIONS:
Do NOT change or modify anything in the original photo.
Preserve the person's exact facial identity, face shape, eyes, nose, lips, skin texture, and natural expressions.
Do NOT regenerate, reshape, beautify, or alter the face.
Do NOT change the person's hairstyle, clothing, body shape, or background.
Maintain the original natural appearance.

ENHANCEMENT TASKS:
Slightly increase brightness to make the photo look brighter and clearer.
Improve exposure and lighting naturally.
Adjust contrast for a balanced and professional appearance.
Correct white balance and natural colors.
Improve sharpness and image clarity.
Reduce image noise while preserving natural skin texture.
Enhance details and resolution as much as possible.
Make the overall photo look clean, fresh, bright, and professionally polished.

STRICT RULES:
No artificial beauty filters.
No excessive skin smoothing.
No facial modifications.
No unrealistic colors or lighting.
No adding or removing objects.
No cropping or changing the original composition.

FINAL REQUIREMENT: Keep the original photo and the person's identity exactly the same. Only improve brightness, lighting, clarity, sharpness, and overall image quality.

The result must look like the original photograph taken with a better-quality professional camera, not an AI-generated or altered image.`;

/** Gemini image enhance with the shop's fixed prompt. */
export const geminiEnhance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourcePath: string; targetPath: string }) => input)
  .handler(async ({ data, context }) => {
    assertOwnPath(data.sourcePath, context.userId);
    assertOwnPath(data.targetPath, context.userId);
    const { data: file, error: dlErr } = await context.supabase.storage.from(BUCKET).download(data.sourcePath);
    if (dlErr || !file) return { ok: false as const, error: `Could not read photo: ${dlErr?.message ?? "missing"}` };
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const dataUrl = `data:${file.type || "image/jpeg"};base64,${btoa(bin)}`;
      const res = await generateChatCompletion({
        model: "google/gemini-3-pro-image",
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: GEMINI_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      } as Parameters<typeof generateChatCompletion>[0]);
      const msg = (res as unknown as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[] }).choices?.[0]?.message;
      const url = msg?.images?.[0]?.image_url?.url;
      if (!url || !url.startsWith("data:")) return { ok: false as const, error: "Gemini returned no image." };
      const [head = "", b64 = ""] = url.split(",");
      const type = head.match(/data:([^;]+)/)?.[1] ?? "image/png";
      const out = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const { error: upErr } = await context.supabase.storage
        .from(BUCKET)
        .upload(data.targetPath, out, { contentType: type, upsert: true });
      if (upErr) return { ok: false as const, error: `Could not save result: ${upErr.message}` };
      return { ok: true as const, path: data.targetPath };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("Gemini edit failed", e.code, e.message);
        const m = e.httpStatus === 402 ? "AI credit finished. Please add credit." : e.httpStatus === 429 ? "Too many requests, try again shortly." : e.message;
        return { ok: false as const, error: `Gemini: ${m}` };
      }
      throw e;
    }
  });

/** ChatGPT image edit: restore + blue background while keeping the face unchanged. */
export const chatgptRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourcePath: string; targetPath: string; bgColor?: string }) => input)
  .handler(async ({ data, context }) => {
    assertOwnPath(data.sourcePath, context.userId);
    assertOwnPath(data.targetPath, context.userId);
    const bg = /^#[0-9a-fA-F]{6}$/.test(data.bgColor ?? "") ? data.bgColor! : "#2f6fc9";
    const { data: file, error: dlErr } = await context.supabase.storage.from(BUCKET).download(data.sourcePath);
    if (dlErr || !file) return { ok: false as const, error: `Could not read photo: ${dlErr?.message ?? "missing"}` };
    try {
      const res = await editImage({
        model: "openai/gpt-image-2.5-sunburst",
        image: new File([file], "photo.jpg", { type: file.type || "image/jpeg" }),
        prompt: chatgptPrompt(bg),
        quality: "high",
        output_format: "png",
      });
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) return { ok: false as const, error: "ChatGPT returned no image." };
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const { error: upErr } = await context.supabase.storage
        .from(BUCKET)
        .upload(data.targetPath, bin, { contentType: "image/png", upsert: true });
      if (upErr) return { ok: false as const, error: `Could not save result: ${upErr.message}` };
      return { ok: true as const, path: data.targetPath };
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("ChatGPT edit failed", e.code, e.message);
        const msg = e.httpStatus === 402 ? "AI credit finished. Please add credit." : e.httpStatus === 429 ? "Too many requests, try again shortly." : e.message;
        return { ok: false as const, error: `ChatGPT: ${msg}` };
      }
      throw e;
    }
  });
