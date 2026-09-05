import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { connect, setupFixture } from "./fixture-db";

const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
const ARTIFACT_DIR = path.join(process.cwd(), "e2e", ".artifacts");

/** A minimal but structurally valid PDF, small enough to upload instantly. */
const TINY_PDF = [
  "%PDF-1.4",
  "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
  "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
  "trailer<</Root 1 0 R>>",
  "%%EOF",
  "",
].join("\n");


/**
 * The browser PUTs straight to Tencent COS, so the bucket must allow the app
 * origin via CORS. Probing here lets the upload specs skip with an actionable
 * reason instead of failing as if the app were broken — and lets them start
 * running by themselves the moment the bucket rule is added.
 */
async function probeCorsReady(origin: string): Promise<boolean> {
  const bucket = process.env.TENCENT_COS_BUCKET;
  const region = process.env.TENCENT_COS_REGION;
  if (!bucket || !region) return false;
  try {
    const response = await fetch(`https://${bucket}.cos.${region}.myqcloud.com/arena/development/cors-probe`, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "PUT",
        "access-control-request-headers": "content-type",
      },
    });
    const allowed = response.headers.get("access-control-allow-origin");
    return allowed === "*" || allowed === origin;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  loadEnvConfig(process.cwd());

  const sql = connect();
  try {
    const { token } = await setupFixture(sql);

    mkdirSync(AUTH_DIR, { recursive: true });
    writeFileSync(
      path.join(AUTH_DIR, "state.json"),
      JSON.stringify(
        {
          cookies: [
            {
              name: "sk_participant",
              value: token,
              domain: "localhost",
              path: "/",
              expires: Math.floor(Date.now() / 1000) + 24 * 3600,
              httpOnly: true,
              secure: false,
              sameSite: "Lax",
            },
          ],
          origins: [],
        },
        null,
        2,
      ),
    );

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(path.join(ARTIFACT_DIR, "deliverable.pdf"), TINY_PDF);
    writeFileSync(path.join(ARTIFACT_DIR, "second.pdf"), TINY_PDF);
    writeFileSync(path.join(ARTIFACT_DIR, "catatan.txt"), "tipe file ini tidak diizinkan\n");
    // 21 MB: one byte class over the 20 MB cap, rejected before any upload starts.
    writeFileSync(path.join(ARTIFACT_DIR, "kegedean.pdf"), Buffer.alloc(21 * 1024 * 1024, 0x20));

    const origin = process.env.ARENA_ORIGIN ?? "http://localhost:3001";
    writeFileSync(
      path.join(AUTH_DIR, "env.json"),
      JSON.stringify({ corsReady: await probeCorsReady(origin), origin }, null, 2),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
