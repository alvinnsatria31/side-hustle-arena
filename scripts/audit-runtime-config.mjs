import fs from 'node:fs';
import { parseEnv } from 'node:util';
import postgres from 'postgres';

const env = { ...parseEnv(fs.readFileSync('.env', 'utf8')), ...process.env };
const report = {};
const origin = (value) => { try { return new URL(value).origin; } catch { return 'invalid-or-unset'; } };
report.origins = Object.fromEntries(['ARENA_ORIGIN', 'SK_AUTH_ORIGIN', 'AI_API_BASE_URL'].map((key) => [key, origin(env[key])]));
report.requiredPresence = Object.fromEntries(['DATABASE_URL', 'SESSION_SECRET', 'STORAGE_BUCKET', 'STORAGE_REGION', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY', 'ARENA_EVAL_TOKEN', 'INTERNAL_AUTOMATION_TOKEN', 'CRON_SECRET', 'RESEND_API_KEY', 'ARENA_FROM_EMAIL', 'ARENA_ADMIN_SUBJECTS', 'ARENA_ADMIN_ROLES'].map((key) => [key, Boolean(env[key]?.trim())]));
if (env.DATABASE_URL) {
  const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 8, idle_timeout: 1, connection: { statement_timeout: 8000 } });
  try {
    report.database = await sql.begin('read only', async (tx) => {
      const tables = await tx`select table_schema, table_name from information_schema.tables where table_schema in ('arena','rewards','identity','notifications')`;
      const available = new Set(tables.map((row) => `${row.table_schema}.${row.table_name}`));
      const counts = {};
      for (const name of ['arena.weeks', 'arena.projects', 'arena.review_jobs', 'arena.review_artifacts', 'rewards.catalog', 'rewards.inventory_periods', 'rewards.redemptions']) {
        counts[name] = available.has(name) ? Number((await tx`select count(*) as count from ${tx(name)}`)[0].count) : 'TABLE_MISSING';
      }
      const weekStates = available.has('arena.weeks') ? await tx`select status, count(*)::int as count from arena.weeks group by status` : [];
      const queue = available.has('arena.review_jobs') ? await tx`select status, count(*)::int as count from arena.review_jobs group by status` : [];
      const evidenceColumn = await tx`select count(*)::int as count from information_schema.columns where table_schema='arena' and table_name='review_scores' and column_name='evidence'`;
      return { reachable: true, counts, weekStates, queue, evidenceColumn: evidenceColumn[0].count === 1 };
    });
  } catch (error) { report.database = { reachable: false, errorCode: error.code ?? error.name }; }
  finally { await sql.end({ timeout: 2 }); }
}
if (env.AI_API_KEY && env.AI_API_BASE_URL) {
  const url = new URL(env.AI_API_BASE_URL);
  if (url.protocol !== 'https:' || url.username || url.password) report.ai = { checked: false, reason: 'HTTPS_REQUIRED' };
  else {
    try {
      const response = await fetch(`${env.AI_API_BASE_URL.replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${env.AI_API_KEY}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
      const payload = response.ok ? await response.json() : null;
      const ids = new Set(Array.isArray(payload?.data) ? payload.data.map((model) => model.id) : []);
      report.ai = { modelsEndpointStatus: response.status, configuredModelsListed: Object.fromEntries(['AI_REVIEW_MODEL', 'AI_JUDGE_MODEL', 'AI_GENERATION_MODEL'].map((key) => [key, ids.has(env[key])])) };
    } catch (error) { report.ai = { checked: false, error: error.name }; }
  }
}
report.productionRoutes = {};
for (const path of ['/', '/api/arena/week/current', '/api/arena/projects']) {
  try {
    const response = await fetch(`https://arena.sekolahkarir.id${path}`, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
    report.productionRoutes[path] = { status: response.status, contentType: response.headers.get('content-type'), server: response.headers.get('server') };
    await response.body?.cancel();
  } catch (error) { report.productionRoutes[path] = { error: error.name }; }
}
console.log(JSON.stringify(report, null, 2));
