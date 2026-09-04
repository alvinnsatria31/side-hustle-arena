import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { ingestExternalReview } from "@/server/reviews/eval-ingest";
import { reviewerOutputSchema } from "@/server/reviews/review-schema";

/**
 * POST /api/webhooks/arena-eval — external grading ingest (VPS/n8n engine).
 *
 * Port of the website's arena-eval webhook, adapted to the job queue: the
 * grader works a version through the same lease pipeline (find PENDING job →
 * validate + score server-side → persist). No PENDING job (already done, or a
 * duplicate delivery) returns `{ ok: true, deduped: true }` — a retry can
 * never double-score.
 *
 * Auth: `Authorization: Bearer <ARENA_EVAL_TOKEN>` (separate least-privilege
 * token from the internal automation token). Fail-closed when unset.
 */

export const dynamic = "force-dynamic";

const evalSchema = z.object({
  version_id: z.string().uuid(),
  output: reviewerOutputSchema,
  model: z.string().trim().max(120).optional(),
  worker_label: z.string().trim().max(80).default("n8n-grading"),
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
}

export async function POST(request: Request) {
  const expected = process.env.ARENA_EVAL_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  const [scheme, presented] = header.split(" ");
  if (!expected || scheme !== "Bearer" || !presented) return unauthorized();
  const expectedBuffer = Buffer.from(expected);
  const presentedBuffer = Buffer.from(presented);
  if (expectedBuffer.length !== presentedBuffer.length || !timingSafeEqual(expectedBuffer, presentedBuffer)) {
    return unauthorized();
  }
  const parsed = evalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload." }, { status: 400 });
  }
  try {
    const result = await ingestExternalReview({
      versionId: parsed.data.version_id,
      workerLabel: parsed.data.worker_label,
      output: parsed.data.output,
      model: parsed.data.model,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const status = code === "REVIEW_VALIDATION_FAILED" ? 422 : code === "REVIEW_JOB_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ ok: false, error: code ?? "INTERNAL_ERROR" }, { status });
  }
}
