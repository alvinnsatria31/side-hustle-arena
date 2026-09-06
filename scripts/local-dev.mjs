import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { localEnvironment, localEnvFile } from './local-env.mjs';

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: 'inherit', shell: false });
    const stop = () => child.kill('SIGTERM');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    child.once('error', reject);
    child.once('exit', code => {
      process.removeListener('SIGINT', stop);
      process.removeListener('SIGTERM', stop);
      if (code === 0) resolve(); else reject(new Error(`${command} exited unsuccessfully.`));
    });
  });
}

async function main() {
  if (process.argv.slice(2).some(arg => !['--setup-only', '--stop'].includes(arg))) throw new Error('Usage: node scripts/local-dev.mjs [--setup-only | --stop]');
  const env = localEnvironment({ create: true });
  const compose = ['compose', '--env-file', localEnvFile, '-f', 'compose.local.yml'];
  if (process.argv.includes('--stop')) {
    await run('docker', [...compose, 'stop'], env);
    return;
  }
  console.log('LOCAL FIXTURE SANDBOX: PostgreSQL + MinIO only. No email, cloud AI, payouts or external webhooks.');
  await run('docker', ['info', '--format', '{{.ServerVersion}}'], env);
  await run('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '120'], env);
  const storage = new S3Client({ endpoint: env.STORAGE_ENDPOINT, region: env.STORAGE_REGION, forcePathStyle: true, credentials: { accessKeyId: env.STORAGE_ACCESS_KEY_ID, secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY } });
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await storage.send(new HeadBucketCommand({ Bucket: env.STORAGE_BUCKET }));
        break;
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404) {
          await storage.send(new CreateBucketCommand({ Bucket: env.STORAGE_BUCKET }));
          break;
        }
        if (attempt >= 30) throw new Error('Local storage did not become ready. Check Docker Desktop.');
        await delay(1000);
      }
    }
  } finally { storage.destroy(); }
  for (const script of ['db-migrate.mjs', 'seed-arena-core.mjs', 'seed-rewards-catalog.mjs']) await run(process.execPath, [`scripts/${script}`], env);
  console.log('Sandbox ready: http://localhost:3001/dev — use the fixture login buttons.\nCtrl+C stops Next; node scripts/local-dev.mjs --stop stops containers and keeps local data.');
  if (!process.argv.includes('--setup-only')) await run(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3001'], env);
}

main().catch(() => {
  console.error('Local sandbox could not start. Ensure Docker Desktop (Linux containers) is running and ports 3001, 55432, 59000 and 59001 are free. Existing environment files were preserved; credentials are never printed.');
  process.exitCode = 1;
});
