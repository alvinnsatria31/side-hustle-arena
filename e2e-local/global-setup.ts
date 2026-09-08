import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { localEnvironment } from "../scripts/local-env.mjs";
import { AUTH_SUBJECT, ADMIN_SUBJECT, PARTICIPANT_ID, ADMIN_ID, connect, mintParticipantToken, setupFixture } from "./fixtures";

const AUTH_DIR = path.join(process.cwd(), "e2e-local", ".auth");

/**
 * Compile the routes the suite drives before any test starts.
 *
 * A dev server builds each route on its first request, and those first builds
 * routinely outrun a test's timeout — which surfaces as a click that seems to
 * do nothing, on a different test each run. Paying that cost once here keeps
 * the failures that remain about the product.
 */
async function warmRoutes(origin: string, token: string, adminToken: string) {
  const participantPaths = ["/app/arena", "/app/jobs", "/app/career-report", "/app/profile", "/arena/showcase", "/app/cv-scanner"];
  for (const route of participantPaths) {
    await fetch(`${origin}${route}`, { headers: { cookie: `sk_participant=${token}` }, signal: AbortSignal.timeout(150_000) }).catch(() => undefined);
  }
  for (const route of ["/app/admin", "/app/admin/careers", "/app/admin/jobs"]) {
    await fetch(`${origin}${route}`, { headers: { cookie: `sk_participant=${adminToken}` }, signal: AbortSignal.timeout(150_000) }).catch(() => undefined);
  }
}

function cookieState(token: string) {
  return {
    cookies: [{
      name: "sk_participant", value: token, domain: "localhost", path: "/",
      expires: Math.floor(Date.now() / 1000) + 4 * 3600, httpOnly: true, secure: false, sameSite: "Lax" as const,
    }],
    origins: [],
  };
}

export default async function globalSetup() {
  const env = localEnvironment();
  for (const [key, value] of Object.entries(env)) process.env[key] = String(value);

  const sql = connect();
  try {
    await setupFixture(sql);
    const token = await mintParticipantToken(PARTICIPANT_ID);
    const adminToken = await mintParticipantToken(ADMIN_ID);
    mkdirSync(AUTH_DIR, { recursive: true });
    writeFileSync(path.join(AUTH_DIR, "state.json"), JSON.stringify(cookieState(token), null, 2));
    writeFileSync(path.join(AUTH_DIR, "admin.json"), JSON.stringify(cookieState(adminToken), null, 2));
    writeFileSync(path.join(AUTH_DIR, "subjects.json"), JSON.stringify({ participant: AUTH_SUBJECT, admin: ADMIN_SUBJECT }, null, 2));
    await warmRoutes(env.ARENA_ORIGIN, token, adminToken);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
