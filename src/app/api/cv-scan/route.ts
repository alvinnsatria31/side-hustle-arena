import { extname } from "node:path";
import { arenaData } from "@/server/arena/http";
import { extractDocumentText } from "@/server/reviews/extract";
import { analyseCvText, toCvResult } from "@/server/cv/analyzer";
import { checkRateLimit, clientKey } from "@/server/cv/rate-limit";
import { saveCompletedCvScan } from "@/server/cv/history";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import {
  CV_ACCEPTED_EXTENSIONS,
  CV_ACCEPTED_MIME,
  CV_MAX_SIZE_BYTES,
  CV_MAX_SIZE_MB,
  isCvScannerEnabled,
} from "@/lib/cv-scan-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The Hobby plan caps a function at 60s and clamps anything larger, so asking
// for more than this is a promise the platform will not keep. The analyzer
// budgets against the same ceiling: 45s for the model call, leaving the rest
// for extraction and the response.
export const maxDuration = 60;

/** Messages here are shown to the person who uploaded, so they are in Indonesian. */
function fail(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code: "CV_SCAN_FAILED", message, ...extra } }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Raw documents exist only for this request. Analysis can be saved with opt-in.
 */
export async function POST(request: Request) {
  if (!isCvScannerEnabled()) {
    return fail("CV Scanner belum dibuka.", 404);
  }

  const limit = await checkRateLimit(clientKey(request));
  if (limit.degraded) {
    // The shared counter is unreachable, so this instance is guarding the AI
    // bill on its own. Worth knowing about before the invoice says so.
    console.warn("cv-scan rate limiter fell back to in-memory counting; the shared counter is unavailable.");
  }
  if (!limit.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan. Coba lagi nanti." } },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let file: File;
  let saveRequested = false;
  try {
    const form = await request.formData();
    saveRequested = form.get("saveHistory") === "true";
    if (saveRequested && !hasAllowedMutationOrigin(request)) return fail("Asal permintaan tidak diizinkan.", 403);
    const candidate = form.get("file");
    if (!(candidate instanceof File)) return fail("Tidak ada file yang dikirim.", 400);
    file = candidate;
  } catch {
    return fail("Permintaan tidak valid.", 400);
  }

  if (file.size === 0) return fail("File kosong.", 400);
  if (file.size > CV_MAX_SIZE_BYTES) return fail(`Ukuran file melebihi ${CV_MAX_SIZE_MB} MB.`, 413);

  // Browsers disagree about the docx type, so the extension is authoritative
  // and the declared type only has to not contradict it.
  const extension = extname(file.name).toLowerCase();
  const accepted = (CV_ACCEPTED_EXTENSIONS as readonly string[]).includes(extension);
  const declared = file.type ? CV_ACCEPTED_MIME[file.type] : undefined;
  if (!accepted || (file.type && declared && declared !== extension)) {
    return fail(`Format tidak didukung. Gunakan ${CV_ACCEPTED_EXTENSIONS.join(" atau ")}.`, 415);
  }

  let text: string;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    text = await extractDocumentText(bytes, file.name, file.type || "application/octet-stream");
  } catch (extractError) {
    // The extractor's own messages describe internal state; this one is for a person.
    console.error("CV extract failed:", extractError);
    return fail("Isi CV tidak terbaca. Pastikan filenya bukan hasil scan gambar dan tidak terkunci password.", 422);
  }

  try {
    const analysis = await analyseCvText(text);
    const result = toCvResult(analysis, file.name);
    const save = await saveCompletedCvScan(result, saveRequested);
    return arenaData({ result, save });
  } catch (error) {
    // A configuration mistake and a bad document fail very differently; only the
    // second is the uploader's problem, so keep them apart in the logs.
    console.error("CV scan failed:", error);
    // A timeout is not a transient blip: the same CV will time out again, so
    // "try again shortly" would send someone in a loop. Say what actually
    // happened and what would change the outcome.
    // The provider's quota is exhausted, not the visitor's fault and not
    // permanent. 503 + Retry-After is the honest shape for "come back shortly".
    if (typeof (error as { status?: number })?.status === "number" && (error as { status: number }).status === 429) {
      return Response.json(
        { error: { code: "CV_SCAN_BUSY", message: "Layanan analisis sedang penuh. Coba lagi beberapa menit lagi." } },
        { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "120" } },
      );
    }
    if (error instanceof Error && error.name === "TimeoutError") {
      return fail("Analisis memakan waktu terlalu lama. Coba CV yang lebih ringkas, atau ulangi beberapa saat lagi.", 504);
    }
    // Below here the visitor's message stays the same, but the code does not.
    // A deployment we misconfigured and a provider having a bad day are the
    // same 502 to a reader, and that ambiguity cost real debugging time: both
    // fail in about a second and say "coba lagi". Separating them means the
    // next failure names itself. `code` carries no secret — only which half of
    // the system is at fault, and for a provider rejection its status.
    const status = (error as { status?: number }).status;
    if (error instanceof Error && /is not configured|must use HTTPS/.test(error.message)) {
      return fail("Analisis belum bisa dijalankan. Tim kami sedang memperbaikinya.", 500, { code: "CV_SCAN_MISCONFIGURED" });
    }
    if (typeof status === "number") {
      return fail("Analisis gagal diselesaikan. Coba lagi sebentar lagi.", 502, { code: `CV_SCAN_PROVIDER_${status}` });
    }
    const message = error instanceof Error && error.message.startsWith("Dokumen terlalu pendek")
      ? error.message
      : "Analisis gagal diselesaikan. Coba lagi sebentar lagi.";
    return fail(message, 502);
  }
}
