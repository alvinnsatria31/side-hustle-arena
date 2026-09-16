import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorageClient } from "@/server/storage/storage-client";
import { getStorageConfig } from "@/server/storage/config";

/**
 * AI-generated project card covers (fail-open).
 *
 * Text generation must never be blocked by image generation: every function
 * here returns null / throws nothing that the caller is required to handle —
 * the generation workflow treats a null cover as "render the per-division
 * data-viz fallback block instead".
 */

export interface CoverImageProvider {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function createCoverImageProvider(env: NodeJS.ProcessEnv = process.env): CoverImageProvider | null {
  if (env.ARENA_COVER_ENABLED === "false") return null;
  const baseUrl = env.AI_API_BASE_URL;
  const apiKey = env.AI_API_KEY;
  const model = env.AI_IMAGE_MODEL || env.AI_GENERATION_MODEL;
  if (!baseUrl || !apiKey || !model) return null;
  const raw = env.ARENA_COVER_TIMEOUT_MS;
  const parsed = raw === undefined || raw.trim() === "" ? 60_000 : Number(raw);
  const timeoutMs = Number.isFinite(parsed) ? Math.min(120_000, Math.max(15_000, parsed)) : 60_000;
  return { baseUrl, apiKey, model, timeoutMs };
}

/** Per-division visual hint — mirrors the Stitch design MD cover templates. */
export function coverHintForDivision(divisionSlug: string, divisionName: string): string {
  const hay = `${divisionSlug} ${divisionName}`.toLowerCase();
  if (hay.includes("system") || hay.includes("token"))
    return "color token swatch labeled --color-primary-600 with a small AAA 7.8:1 badge";
  if (hay.includes("science") || hay.includes(" ml") || hay.includes("machine") || hay.includes("churn"))
    return "big metric callout ROC-AUC 0.914 with Precision Lift +28.4%";
  if (hay.includes("growth") || hay.includes("b2b") || hay.includes("onboard") || hay.includes("funnel") || hay.includes("checkout"))
    return "three-step funnel diagram Step 1 100 percent, KYC 38 percent, Target 65 percent";
  if (hay.includes("product") || hay.includes("pos") || hay.includes("kasir"))
    return "four mini score blocks labeled REACH, IMPACT, CONF, RICE";
  if (hay.includes("ux") || hay.includes("design") || hay.includes("mood") || hay.includes("mental"))
    return "mood check-in bar at 78 percent with a small smiley, minimal prototype motif";
  if (hay.includes("data") || hay.includes("analy") || hay.includes("stok") || hay.includes("ritel") || hay.includes("sql"))
    return "deep-blue line chart over a faint grid, cohort dashboard motif, one rising curve with a dot marker";
  return "abstract editorial geometric composition with the division name as a small mono label";
}

const COVER_STYLE =
  "Light editorial dashboard illustration, cool off-white #F6F8FC background, electric-blue #246BFD accents, flat vector, hairline borders, high contrast, no people faces, no photographs, minimal text";

export function buildCoverPrompt(input: {
  divisionSlug: string;
  divisionName: string;
  title: string;
  coreSkill?: string;
  secondarySkill?: string;
  primaryDeliverable?: string;
  targetStakeholder?: string;
}): string {
  const parts = [
    COVER_STYLE,
    `Subject: ${coverHintForDivision(input.divisionSlug, input.divisionName)}`,
    `Project: ${input.title.slice(0, 120)}`,
  ];
  if (input.coreSkill) parts.push(`Core skill: ${input.coreSkill}`);
  if (input.secondarySkill) parts.push(`Secondary: ${input.secondarySkill}`);
  if (input.primaryDeliverable) parts.push(`Deliverable: ${input.primaryDeliverable}`);
  if (input.targetStakeholder) parts.push(`Audience: ${input.targetStakeholder}`);
  parts.push("Landscape 16:9, systematic, abstract, never a literal screenshot copy.");
  return parts.join(". ").slice(0, 900);
}

export async function generateCoverImageBytes(
  prompt: string,
  provider: CoverImageProvider,
  transport: typeof fetch = fetch,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), provider.timeoutMs);
  try {
    const res = await transport(`${provider.baseUrl.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({ model: provider.model, prompt, size: "1536x1024", response_format: "b64_json" }),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length > 12_000_000) return null;
    const body = JSON.parse(text) as { data?: Array<{ b64_json?: string; url?: string }> };
    const item = body.data?.[0];
    if (!item) return null;
    if (item.b64_json) {
      const bytes = Buffer.from(item.b64_json, "base64");
      if (bytes.length === 0 || bytes.length > 8_000_000) return null;
      return { bytes, mimeType: "image/png" };
    }
    if (item.url && item.url.startsWith("https://")) {
      const img = await transport(item.url, { signal: ctrl.signal });
      if (!img.ok) return null;
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length === 0 || buf.length > 8_000_000) return null;
      return { bytes: buf, mimeType: img.headers.get("content-type") || "image/png" };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function coverKeyForSlug(slug: string): string {
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "project";
  return `arena-covers/${safe}.png`;
}

/**
 * Persist cover bytes. COS first (production/VPS); local public/ fallback for
 * development without storage credentials. Returns the value to store in
 * projects.cover_image_url, or null when neither backend is available.
 */
export async function saveCoverImage(slug: string, bytes: Buffer, mimeType: string): Promise<string | null> {
  const key = coverKeyForSlug(slug);
  try {
    const config = getStorageConfig();
    await getStorageClient().send(
      new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: bytes, ContentType: mimeType }),
    );
    return key;
  } catch {
    // No storage credentials (local dev): write under public/ so the card can
    // use it directly. Serverless runtimes are read-only here — that path is
    // only reached in development, never as a production requirement.
    try {
      const dir = path.join(process.cwd(), "public", "arena-covers");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, path.basename(key)), bytes);
      return `/arena-covers/${path.basename(key)}`;
    } catch {
      return null;
    }
  }
}
