import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { toCvResult } from '../src/server/cv/analyzer.ts';
import { cvHistoryResultSchema, saveCompletedCvScan } from '../src/server/cv/history.ts';

const result = toCvResult({
  overallScore: 72, statusLabel: 'GOOD FOUNDATION',
  metrics: { quality: 80, ats: 80, impact: 70, evidence: 58 },
  strengths: ['Struktur CV jelas.'], improvements: ['Tambahkan bukti hasil.'],
  skills: [{ skill: 'Excel', level: 'cukup', note: 'Didukung pengalaman kerja.' }],
  qualityChecks: [{ label: 'Struktur', pass: true, note: 'Bagian mudah dibaca.' }],
  atsChecks: [{ label: 'Format', pass: true, note: 'Teks dapat dibaca mesin.' }], impactExamples: [],
}, 'cv.pdf', new Date('2026-09-07T00:00:00Z'));

test('anonymous opt-out never invokes authentication or persistence', async () => {
  const unexpected = async () => assert.fail('must not be called');
  assert.deepEqual(await saveCompletedCvScan(result, false, { getUser: unexpected, save: unexpected }), { status: 'not_requested' });
});

test('opt-in binds scanner result to the authenticated owner', async () => {
  let saved;
  const status = await saveCompletedCvScan(result, true, {
    getUser: async () => ({ id: 'owner-a' }),
    save: async (userId, analysis) => { saved = { userId, analysis }; return { id: 'scan-a' }; },
  });
  assert.deepEqual(saved, { userId: 'owner-a', analysis: result });
  assert.deepEqual(status, { status: 'saved', id: 'scan-a' });
});

test('missing session or unavailable DB never discards completed analysis', async () => {
  assert.deepEqual(await saveCompletedCvScan(result, true, { getUser: async () => null, save: async () => assert.fail() }), { status: 'sign_in_required' });
  assert.deepEqual(await saveCompletedCvScan(result, true, { getUser: async () => ({ id: 'a' }), save: async () => { throw Error('offline'); } }), { status: 'failed' });
  assert.equal(result.score, 72);
});

test('persisted analysis is bounded and strips non-result raw document fields', () => {
  const parsed = cvHistoryResultSchema.parse({ ...result, rawText: 'SECRET', bytes: 'SECRET' });
  assert.deepEqual(parsed, result);
  assert.equal(cvHistoryResultSchema.safeParse({ ...result, score: 101 }).success, false);
  assert.equal(cvHistoryResultSchema.safeParse({ ...result, strengths: Array(50).fill('test') }).success, false);
});

test('generated migration adds owner FK, index and analysis-only columns', async () => {
  const migration = await readFile(new URL('../drizzle/0010_neat_psylocke.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE "arena"\."cv_scans"/);
  assert.match(migration, /"result" jsonb NOT NULL/);
  assert.match(migration, /REFERENCES "identity"\."users"\("id"\) ON DELETE cascade/);
  assert.match(migration, /"cv_scans_user_created_idx"/);
  assert.doesNotMatch(migration, /raw_text|document_text|file_bytes|storage_key/i);
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
  assert.ok(journal.entries.some(entry => entry.tag === '0010_neat_psylocke'));
});
