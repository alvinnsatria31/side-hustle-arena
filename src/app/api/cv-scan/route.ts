import { extname } from "node:path";
import { arenaData } from "@/server/arena/http";
import { extractDocumentText } from "@/server/reviews/extract";
import { analyseCvText, toCvResult } from "@/server/cv/analyzer";
import { checkRateLimit, clientKey } from "@/server/cv/rate-limit";
import {
  CV_ACCEPTED_EXTENSIONS,
  CV_ACCEPTED_MIME,
  CV_MAX_SIZE_BYTES,
  CV_MAX_SIZE_MB,
  isCvScannerEnabled,
} from "@/lib/cv-scan-limits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Messages here are shown to the person who uploaded, so they are in Indonesian. */
function fail(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code: "CV_SCAN_FAILED", message, ...extra } }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Scan one CV: bytes in, analysis out. Nothing is written to storage or the
 * database — the document exists only for the duration of this request.
 */
export async function POST(request: Request) {
  if (!isCvScannerEnabled()) {
    return fail("CV Scanner belum dibuka.", 404);
  }

  const limit = checkRateLimit(clientKey(request));
  if (!limit.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Terlalu banyak permintaan. Coba lagi nanti." } },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let file: File;
  try {
    const form = await request.formData();
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
  } catch {
    // The extractor's own messages describe internal state; this one is for a person.
    return fail("Isi CV tidak terbaca. Pastikan filenya bukan hasil scan gambar dan tidak terkunci password.", 422);
  }

  try {
    const analysis = await analyseCvText(text);
    return arenaData({ result: toCvResult(analysis, file.name) });
  } catch (error) {
    // A configuration mistake and a bad document fail very differently; only the
    // second is the uploader's problem, so keep them apart in the logs.
    console.error("CV scan failed:", error);
    const message = error instanceof Error && error.message.startsWith("Dokumen terlalu pendek")
      ? error.message
      : "Analisis gagal diselesaikan. Coba lagi sebentar lagi.";
    return fail(message, 502);
  }
}
