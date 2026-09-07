// Start Next.js dev server with local sandbox environment
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.join(__dirname, '..');

process.env.NODE_ENV = 'development';
process.env.APP_ENV = 'development';
process.env.ARENA_LOCAL_SANDBOX = '1';
process.env.ARENA_ORIGIN = 'http://localhost:3001';
process.env.ARENA_ALLOWED_ORIGINS = 'http://localhost:3001';
process.env.SK_AUTH_ORIGIN = 'http://localhost:3001';
process.env.ARENA_ADMIN_SUBJECTS = 'sk-participant:local-sandbox-admin';
process.env.AI_REVIEW_PROVIDER = 'stub';
process.env.STORAGE_BUCKET = 'arena-local-fixtures';
process.env.STORAGE_REGION = 'us-east-1';
process.env.STORAGE_ENDPOINT = 'http://127.0.0.1:59000';
process.env.DATABASE_URL = 'postgres://arena_local:80b31fb6922ff1ef22f08643bd576146559b8bb0c3b8f603@127.0.0.1:55432/arena_local';
process.env.STORAGE_ACCESS_KEY_ID = 'arena-local-fixture';
process.env.STORAGE_SECRET_ACCESS_KEY = 'e70a018400abedaa36e58ea457c9bbdbf9bd9d81b5316ed55f5c9bfe4dabd47';
process.env.SESSION_SECRET = 'b45d67122316a169c0333de4a89b42ca387327fe59925811e7cde8f1c7b2d9b33edd96ed01c7920ff2f2be759adc3fc2';
process.env.NEXT_PUBLIC_CV_SCANNER_ENABLED = 'false';

// Clear any production vars
delete process.env.VERCEL;
delete process.env.VERCEL_ENV;
delete process.env.VERCEL_OIDC_TOKEN;

const nextBin = path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn('node', [nextBin, 'dev', '--hostname', '127.0.0.1', '--port', '3001'], {
  stdio: 'inherit',
  env: process.env,
  cwd,
});

child.on('error', (err) => console.error('Failed to start:', err.message));
child.on('exit', (code) => {
  console.log('Next.js exited with code:', code);
  process.exit(code ?? 0);
});
