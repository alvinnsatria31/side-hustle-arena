import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
process.env.NEXT_PUBLIC_CV_SCANNER_ENABLED = 'true';

const route = await import('../src/app/api/cv-scan/route.ts');
const { resetRateLimit } = await import('../src/server/cv/rate-limit.ts');
const bytes = await readFile(fileURLToPath(new URL('../qa-files/cv-sample.pdf', import.meta.url)));

async function hit(tag) {
  resetRateLimit();
  const form = new FormData();
  form.append('file', new File([bytes], 'cv-sample.pdf', { type: 'application/pdf' }));
  const req = new Request('https://arena.local/api/cv-scan', {
    method: 'POST', body: form, headers: { 'x-forwarded-for': `203.0.113.${Math.floor(Math.random()*250)+1}` },
  });
  const t = performance.now();
  const res = await route.POST(req);
  const dt = ((performance.now() - t) / 1000).toFixed(1);
  const body = await res.json();
  console.log(`${tag}: HTTP ${res.status} in ${dt}s  score=${body?.data?.result?.score}`);
}

await hit('cold  (first call this process)');
await hit('repeat(identical prompt again)');
