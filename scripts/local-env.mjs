import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { isLocalSandboxEnvironment } from '../src/server/dev/guard.ts';

export const localEnvFile = '.env.arena-local';
export function localEnvironment({ create = false } = {}) {
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production' || process.env.VERCEL || process.env.VERCEL_ENV) throw new Error('Local sandbox refuses production or Vercel processes. Start it in a development terminal.');
  if (!existsSync(localEnvFile)) {
    if (!create) throw new Error('Run node scripts/local-dev.mjs first.');
    const dbPassword = randomBytes(24).toString('hex');
    const values = {
      LOCAL_POSTGRES_PASSWORD: dbPassword,
      DATABASE_URL: `postgres://arena_local:${dbPassword}@127.0.0.1:55432/arena_local`,
      SESSION_SECRET: randomBytes(48).toString('hex'),
      STORAGE_ACCESS_KEY_ID: 'arena-local-fixture',
      STORAGE_SECRET_ACCESS_KEY: randomBytes(32).toString('hex'),
    };
    writeFileSync(localEnvFile, '# Generated local sandbox credentials. Never use in production.\n' + Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  const env = { ...process.env };
  // Next loads .env files itself. Explicit empty values take precedence and
  // prevent a developer's real service credentials leaking into this sandbox.
  for (const name of readdirSync('.').filter(name => /^\.env(?:\.|$)/.test(name))) {
    for (const key of Object.keys(parseEnv(readFileSync(name, 'utf8')))) env[key] = '';
  }
  for (const key of Object.keys(env)) {
    if (/^(?:AI_|ARENA_|INTERNAL_|VPS_|RESEND_|MAIN_SITE_|SK_AUTH_|STORAGE_|TENCENT_|COS_|R2_|CRON_|COOKIE_|SESSION_|SSESSION_|NEXT_PUBLIC_)/.test(key)) env[key] = '';
  }
  const saved = parseEnv(readFileSync(localEnvFile, 'utf8'));
  for (const key of ['LOCAL_POSTGRES_PASSWORD', 'DATABASE_URL', 'SESSION_SECRET', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY']) env[key] = saved[key] ?? '';
  Object.assign(env, {
    NODE_ENV: 'development', APP_ENV: 'development', ARENA_LOCAL_SANDBOX: '1',
    ARENA_ORIGIN: 'http://localhost:3001', ARENA_ALLOWED_ORIGINS: 'http://localhost:3001', SK_AUTH_ORIGIN: 'http://localhost:3001',
    ARENA_ADMIN_SUBJECTS: 'sk-participant:local-sandbox-admin',
    AI_REVIEW_PROVIDER: 'stub', NEXT_PUBLIC_CV_SCANNER_ENABLED: 'false',
    STORAGE_BUCKET: 'arena-local-fixtures', STORAGE_REGION: 'us-east-1', STORAGE_ENDPOINT: 'http://127.0.0.1:59000',
  });
  // Only generated connection/secret values are editable. A local-file service
  // token must never turn a sandbox into an external integration.
  for (const key of ['RESEND_API_KEY', 'VPS_WEBHOOK_BASE_URL', 'VPS_WEBHOOK_TOKEN', 'MAIN_SITE_ORIGIN', 'MAIN_SITE_VOUCHER_TOKEN', 'AI_API_KEY', 'AI_API_BASE_URL', 'INTERNAL_ADMIN_TOKEN', 'INTERNAL_AUTOMATION_TOKEN', 'CRON_SECRET', 'ARENA_EVAL_TOKEN', 'ARENA_ADMIN_ROLES']) env[key] = '';
  if (!isLocalSandboxEnvironment(env)) throw new Error('Sandbox requires a generated secret and a loopback PostgreSQL database named arena_local.');
  return env;
}
