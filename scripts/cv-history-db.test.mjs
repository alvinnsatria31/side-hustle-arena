import test from 'node:test';
import assert from 'node:assert/strict';
import nextEnv from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/server/db/schema/index.ts';
import { saveCvScan, getCvScan, getLatestCvScan, listCvScans, deleteCvScan, CV_HISTORY_LIMIT } from '../src/server/cv/history.ts';
import { toCvResult } from '../src/server/cv/analyzer.ts';

nextEnv.loadEnvConfig(process.cwd());
assert.equal(process.env.APP_ENV, 'development', 'CV history DB checks require APP_ENV=development');
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL must be configured');

test('real DB isolates owners and enforces history retention', async () => {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle({ client: sql, schema });
  const ownerIds = [];
  try {
    const stamp = `cv-history-${Date.now()}`;
    const owners = await sql`insert into identity.users (auth_subject) values (${stamp + '-a'}), (${stamp + '-b'}) returning id`;
    ownerIds.push(...owners.map(owner => owner.id));
    const [a, b] = ownerIds;
    const result = toCvResult({
      overallScore: 72, statusLabel: 'GOOD FOUNDATION', metrics: { quality: 80, ats: 80, impact: 70, evidence: 58 },
      strengths: ['Struktur CV jelas.'], improvements: ['Tambahkan bukti hasil.'],
      skills: [{ skill: 'Excel', level: 'cukup', note: 'Didukung pengalaman kerja.' }],
      qualityChecks: [{ label: 'Struktur', pass: true, note: 'Bagian mudah dibaca.' }],
      atsChecks: [{ label: 'Format', pass: true, note: 'Teks dapat dibaca mesin.' }], impactExamples: [],
    }, 'fixture-cv.pdf');
    assert.equal(await getLatestCvScan(a, db), null);
    const saved = await saveCvScan(a, result, db);
    assert.deepEqual((await getCvScan(a, saved.id, db)).result, result);
    assert.equal(await getCvScan(b, saved.id, db), null, 'foreign history is invisible');
    assert.equal(await deleteCvScan(b, saved.id, db), false, 'foreign delete changes nothing');
    assert.equal((await getLatestCvScan(a, db)).id, saved.id);
    assert.deepEqual(await listCvScans(b, db), []);
    assert.ok(await deleteCvScan(a, saved.id, db));
    assert.equal(await getCvScan(a, saved.id, db), null);

    // Seed old synthetic results in one call, then exercise the real save path.
    await db.insert(schema.cvScans).values(Array.from({ length: CV_HISTORY_LIMIT }, (_, i) => ({
      userId: a, result, createdAt: new Date(Date.now() - (CV_HISTORY_LIMIT - i + 1) * 1000),
    })));
    const foreign = await saveCvScan(b, result, db);
    const newest = await saveCvScan(a, result, db);
    const own = await listCvScans(a, db);
    assert.equal(own.length, CV_HISTORY_LIMIT);
    assert.equal(own[0].id, newest.id);
    const [{ count }] = await sql`select count(*)::int as count from arena.cv_scans where user_id = ${a}`;
    assert.equal(count, CV_HISTORY_LIMIT, 'retention deletes old rows, not only hiding them');
    assert.ok(await getCvScan(b, foreign.id, db), 'retention never deletes another owner');
    const columns = await sql`select column_name from information_schema.columns where table_schema = 'arena' and table_name = 'cv_scans' order by column_name`;
    assert.deepEqual(columns.map(row => row.column_name), ['created_at', 'id', 'result', 'user_id']);
  } finally {
    if (ownerIds.length) await sql`delete from identity.users where id in ${sql(ownerIds)}`;
    await sql.end();
  }
});
