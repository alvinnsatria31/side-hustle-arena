// Inbox history cursor (audit: inbox capped at 100). The paging query itself
// is covered against Postgres in scripts/audit-website-wide.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeInboxCursor, encodeInboxCursor } from '../src/server/notifications/service.ts';

const id = '0d224c11-a09f-41dd-8c7c-63484e7f7a0b';

test('a cursor round-trips the microsecond timestamp and id', () => {
  const cursor = encodeInboxCursor('2026-09-11T08:15:30.123456Z', id);
  assert.deepEqual(decodeInboxCursor(cursor), { createdAt: '2026-09-11T08:15:30.123456Z', id });
});

test('a malformed cursor is a validation error, never passed into SQL', () => {
  for (const bad of ['', 'garbage', `2026-09-11T08:15:30.123Z_${id}`, `2026-09-11T08:15:30.123456Z_not-a-uuid`, `2026-09-11T08:15:30.123456Z_${id}'; drop table x;--`]) {
    assert.throws(() => decodeInboxCursor(bad), (error) => error.code === 'VALIDATION_ERROR', bad);
  }
});
