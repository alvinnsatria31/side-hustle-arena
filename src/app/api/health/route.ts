/**
 * Liveness probe for the self-hosted container.
 *
 * Deliberately dependency-free: no database, no config parsing, no imports from
 * the app. It answers "the Node process is up and serving HTTP", which is all a
 * container healthcheck and a reverse-proxy upstream check should decide on.
 * Readiness of the database and object storage is surfaced by the routes that
 * use them, not gated here — a DB blip must not make the orchestrator kill an
 * otherwise healthy process.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", ts: new Date().toISOString() });
}
