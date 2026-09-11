// Production E2E, participant half: the tester works the isolated test week
// through the real public API (Caddy → sk-arena), exactly as the workspace
// page does — draft, repository link, a real PDF uploaded to object storage via
// the presigned URL, and submit. Grading is then left to the real n8n worker.
//
// Usage:
//   E2E_TOKEN_FILE=... E2E_ENROLLMENT=... E2E_FILE_REQ=... E2E_LINK_REQ=... node scripts/_e2e-prod-cycle.mjs
import { readFileSync } from 'node:fs';

const BASE = process.env.E2E_BASE ?? 'https://arena.sekolahkarir.id';
const token = readFileSync(process.env.E2E_TOKEN_FILE, 'utf8').trim();
const enrollmentId = process.env.E2E_ENROLLMENT;
const fileRequirement = process.env.E2E_FILE_REQ;
const linkRequirement = process.env.E2E_LINK_REQ;
if (!token || !enrollmentId || !fileRequirement || !linkRequirement) throw new Error('Missing E2E inputs.');

const headers = { cookie: `sk_participant=${token}`, origin: BASE, 'content-type': 'application/json' };

async function call(method, path, body) {
  const response = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!response.ok || !json || json.error) throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text.slice(0, 400)}`);
  return json.data;
}

/** A small but genuine PDF: valid xref offsets, one page, Helvetica text. */
function makePdf(lines) {
  const escape = (value) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = ['BT', '/F1 10 Tf', '14 TL', '50 800 Td', ...lines.map((line, index) => `${index ? 'T* ' : ''}(${escape(line)}) Tj`), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const report = makePdf([
  'LAPORAN ANALISIS - Pola Permintaan dan Rekomendasi Stok Mingguan (uji E2E internal)',
  '',
  '1. Problem framing',
  'Manajer operasional sering kehabisan stok kategori cepat laku di akhir pekan, sementara',
  'kategori lambat menumpuk. Pertanyaan: berapa stok mingguan per kategori agar stockout < 5%',
  'tanpa menambah modal kerja? Data: 12 minggu transaksi (8.420 baris) dari 3 cabang.',
  '',
  '2. Evidence',
  '- Minuman: rata-rata 1.180 unit/minggu, puncak Sabtu (31% volume), CV 0,18.',
  '- Makanan ringan: 940 unit/minggu, naik 22% di minggu gajian (minggu ke-1 tiap bulan).',
  '- Perawatan rumah: 310 unit/minggu, stabil (CV 0,07), stok rata-rata 2,6 minggu (berlebih).',
  '- Stockout terjadi 9 kali, 7 di antaranya kategori minuman pada Sabtu-Minggu.',
  '- Korelasi promo vs penjualan makanan ringan: r = 0,61 (moderat, bukan satu-satunya faktor).',
  '',
  '3. Recommendation (stok mingguan, dengan safety stock 1,65 x std x sqrt(lead time 1 minggu))',
  '- Minuman: 1.180 + 350 safety = 1.530 unit; kirim ulang Jumat sore sebelum puncak Sabtu.',
  '- Makanan ringan: 940 normal, 1.150 di minggu gajian; kaitkan pemesanan dengan kalender gaji.',
  '- Perawatan rumah: turunkan ke 1,5 minggu stok (465 unit) untuk membebaskan modal kerja.',
  '- Pantau mingguan: stockout rate, weeks of supply, dan akurasi forecast (MAPE target < 15%).',
  '',
  'Keterbatasan: 12 minggu belum mencakup musim liburan; ulangi analisis setelah Lebaran.',
]);

const log = (step, detail) => console.log(`[e2e] ${step}${detail ? ` :: ${detail}` : ''}`);

const before = await call('GET', `/api/arena/enrollments/${enrollmentId}/submission`);
log('auth ok, submission read', `status=${before.status} attempts=${before.reviewAttemptsUsed}`);

await call('PATCH', `/api/arena/enrollments/${enrollmentId}/submission`, {
  explanation: 'Uji E2E internal produksi: analisis pola permintaan ritel dan rekomendasi stok mingguan per kategori.',
});
log('draft saved');

// Resumable: a rerun after a partial failure reuses what already landed
// instead of tripping the one-link / one-file limits.
const hasItem = (requirementId, type) => (before.items ?? []).some((item) => item.requirementId === requirementId && item.itemType === type);

if (hasItem(linkRequirement, 'LINK')) {
  log('link already on the draft, kept');
} else {
  const link = await call('POST', `/api/arena/enrollments/${enrollmentId}/submission/links`, {
    requirementId: linkRequirement, url: 'https://github.com/pandas-dev/pandas',
  });
  log('link added', link.url);
}

if (hasItem(fileRequirement, 'FILE')) {
  log('file already on the draft, kept');
} else {
  const intent = await call('POST', `/api/arena/enrollments/${enrollmentId}/submission/uploads/presign`, {
    requirementId: fileRequirement, filename: 'laporan-analisis-stok-e2e.pdf', mimeType: 'application/pdf', sizeBytes: report.length,
  });
  log('upload intent', `${intent.intentId} -> ${new URL(intent.uploadUrl).host}`);
  // E2E_PUT_VIA lets the PUT be made from another host when this network
  // cannot reach the bucket: the presigned URL is bearer-free and host-agnostic.
  if (process.env.E2E_PUT_VIA) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.E2E_PUT_VIA, JSON.stringify({ url: intent.uploadUrl, headers: intent.requiredHeaders, body: report.toString('base64') }));
    log('presigned PUT handed off', process.env.E2E_PUT_VIA);
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.env.E2E_PUT_CMD, { stdio: 'inherit', shell: true });
  } else {
    const put = await fetch(intent.uploadUrl, { method: 'PUT', headers: intent.requiredHeaders, body: report });
    if (!put.ok) throw new Error(`storage PUT -> HTTP ${put.status}: ${(await put.text()).slice(0, 300)}`);
  }
  log('file stored in object storage', `${report.length} bytes`);
  const item = await call('POST', `/api/arena/enrollments/${enrollmentId}/submission/uploads/${intent.intentId}/finalize`);
  log('upload finalized', `${item.originalFilename} ${item.mimeType} ${item.fileSizeBytes}B`);
}

const submitted = await call('POST', `/api/arena/enrollments/${enrollmentId}/submission/submit`);
log('submitted', `version=${submitted.version.id} access=${submitted.version.accessStatus} attempt=${submitted.version.reviewAttemptNumber}`);
