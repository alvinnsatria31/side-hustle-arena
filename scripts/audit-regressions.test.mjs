import test from 'node:test';
import assert from 'node:assert/strict';
import { completeReviewJob, claimReviewJob } from '../src/server/reviews/queue-service.ts';
import { overrideReview } from '../src/server/reviews/admin.ts';
import { getArenaResult } from '../src/server/finalization/result-service.ts';
import { PgDialect } from 'drizzle-orm/pg-core';
import { reviews } from '../src/server/db/schema/index.ts';

function fakeDb(selections) {
  const writes = [];
  const predicates = [];
  const db = {
    writes, predicates,
    transaction: async (fn) => fn(db),
    select() {
      const rows = selections.shift() ?? [];
      const chain = { then: (resolve) => Promise.resolve(rows).then(resolve) };
      for (const key of ['from', 'innerJoin', 'orderBy', 'limit', 'for']) chain[key] = () => chain;
      chain.where = (predicate) => { predicates.push(predicate); return chain; };
      return chain;
    },
    insert: (table) => ({ values: (value) => { writes.push({ table, value }); return Promise.resolve(); } }),
    update: (table) => ({ set: (value) => ({ where: async () => { writes.push({ table, value }); } }) }),
  };
  return db;
}

test('production completion validates the lease before requesting a judge provider', async () => {
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = 'production';
  try {
    await assert.rejects(completeReviewJob({ jobId: 'missing', workerId: 'worker', output: {}, db: fakeDb([[]]) }),
      (error) => error.code === 'REVIEW_JOB_NOT_FOUND');
  } finally {
    if (previous === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previous;
  }
});

test('manual override resolves disagreement and preserves the original AI score', async () => {
  const row = { id: 'review', status: 'NEEDS_RESOLUTION', aiScore: '60.00', finalScore: '60.00' };
  const db = fakeDb([[row]]);
  await overrideReview({ reviewId: row.id, actorSubject: 'admin', newScore: 75, reason: 'Evidence reviewed', db });
  const update = db.writes.find((write) => write.table === reviews).value;
  assert.equal(update.status, 'COMPLETED_HIDDEN');
  assert.equal(update.finalScore, '75.00');
  assert.equal(update.aiScore, undefined);
});

test('targeted webhook lease includes the requested job and respects retry availability', async () => {
  const db = fakeDb([[]]);
  await claimReviewJob('worker', new Date('2026-09-05T00:00:00Z'), db, 'job-B');
  const query = new PgDialect().sqlToQuery(db.predicates[0]);
  assert.ok(query.params.includes('job-B'));
  assert.match(query.sql, /available_at/);
});

test('partial ranking is sealed until the week is finalized', async () => {
  const db = fakeDb([
    [{ id: 'enrollment', userId: 'user', weekId: 'week' }],
    [{ id: 'week', status: 'FINALIZING' }],
    [{ reviewAttemptsUsed: 1, status: 'SUBMITTED' }],
    [{ reviewId: 'review', rank: 1 }],
    [{ id: 'review' }],
  ]);
  const result = await getArenaResult({ userId: 'user', enrollmentId: 'enrollment', db });
  assert.equal(result.sealed, true);
  assert.equal(result.rank, undefined);
});
