// TEMPORARY: push production environment variables to the Vercel project.
// Reads values from the process env (sourced from .env.deploy + .env.generated).
// Never prints a secret value — only the key name and the outcome.
const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = "prj_xkRTKdJIJqfBF6mGa1pWbbXXJaue";
const TEAM = "team_zG6ZTo31uaXX51QCVfCAcqTH";
if (!TOKEN) throw new Error("VERCEL_TOKEN is required.");

const ARENA_ORIGIN = "https://arena.sekolahkarir.id";
// The gate lives on `www` — the apex only 308-redirects to it — so point
// sign-in at the host that actually serves /arena and skip the hop.
const MAIN_ORIGIN = "https://www.sekolahkarir.id";

/** Values that are fixed for this deployment, plus whatever secrets are present. */
const wanted = {
  APP_ENV: "production",
  ARENA_ORIGIN,
  SK_AUTH_ORIGIN: MAIN_ORIGIN,
  // Mutating requests are origin-checked; the Arena's own pages must be listed
  // or every admin and participant POST is refused. Only the Arena's origin
  // belongs here — nothing on the main site posts to this API, and
  // `sk_participant` is same-site across both hosts, so listing the main origin
  // would widen who can drive a write without buying anything.
  ARENA_ALLOWED_ORIGINS: ARENA_ORIGIN,
  COOKIE_DOMAIN: "sekolahkarir.id",
  STORAGE_REGION: "ap-jakarta",
  INTERNAL_ADMIN_SCOPES: "overview reviews weeks projects rewards users storage",

  DATABASE_URL: process.env.PROD_DATABASE_URL,
  CRON_SECRET: process.env.CRON_SECRET,
  INTERNAL_AUTOMATION_TOKEN: process.env.INTERNAL_AUTOMATION_TOKEN,
  ARENA_EVAL_TOKEN: process.env.ARENA_EVAL_TOKEN,
  INTERNAL_ADMIN_TOKEN: process.env.INTERNAL_ADMIN_TOKEN,

  // Present only once the corresponding credential has been supplied.
  SESSION_SECRET: process.env.MAIN_SESSION_SECRET,
  RESEND_API_KEY: process.env.RESEND_KEY,
  ARENA_FROM_EMAIL: process.env.RESEND_KEY ? "arena@sekolahkarir.id" : undefined,
  STORAGE_BUCKET: process.env.PROD_STORAGE_BUCKET,
  STORAGE_ACCESS_KEY_ID: process.env.TENCENT_SECRET_ID,
  STORAGE_SECRET_ACCESS_KEY: process.env.TENCENT_SECRET_KEY,
};

async function api(path, init) {
  const url = `https://api.vercel.com${path}${path.includes("?") ? "&" : "?"}teamId=${TEAM}`;
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

const skipped = [];
let created = 0;
let updated = 0;

for (const [key, value] of Object.entries(wanted)) {
  if (value === undefined || value === "") {
    skipped.push(key);
    continue;
  }
  const result = await api(`/v10/projects/${PROJECT}/env?upsert=true`, {
    method: "POST",
    body: JSON.stringify({ key, value, type: "encrypted", target: ["production"] }),
  });
  if (!result.ok) {
    console.log(`FAIL ${key}: ${result.status} ${JSON.stringify(result.body?.error ?? result.body).slice(0, 160)}`);
    continue;
  }
  const wasUpsert = Array.isArray(result.body?.updated) && result.body.updated.length > 0;
  if (wasUpsert) updated += 1;
  else created += 1;
  console.log(`ok   ${key}`);
}

console.log(`\nset ${created + updated} variables (${created} new, ${updated} replaced)`);
if (skipped.length) console.log(`still missing: ${skipped.join(", ")}`);
