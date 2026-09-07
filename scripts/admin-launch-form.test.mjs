import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdminLaunchRequest } from '../src/lib/admin-launch-form.ts';

const form = { openNow: true, opensAt: '', deadline: '2026-09-12T23:59', title: '', reason: ' Rilis Selasa ', publish: true };
const now = new Date('2026-09-08T03:12:00Z');

test('manual launch opens at click time on Tuesday and explicitly approves immediate publication', () => {
  const request = buildAdminLaunchRequest(form, now);
  assert.equal(request.opensAt, now.toISOString());
  assert.equal(request.submissionDeadlineAt, '2026-09-12T16:59:00.000Z');
  assert.equal(request.reason, 'Rilis Selasa');
  assert.equal(request.approve, true);
  assert.equal(request.publish, true);
});

test('preview does not approve or publish; chosen WIB time is preserved', () => {
  const request = buildAdminLaunchRequest({ ...form, openNow: false, opensAt: '2026-09-09T08:00', publish: false }, now);
  assert.equal(request.opensAt, '2026-09-09T01:00:00.000Z');
  assert.equal(request.approve, false);
  assert.equal(request.publish, false);
});

test('invalid or expired deadline and missing reason are refused before dispatch', () => {
  for (const change of [{ deadline: '' }, { deadline: '2026-09-08T08:00' }, { reason: ' ' }, { openNow: false, opensAt: '' }]) {
    assert.throws(() => buildAdminLaunchRequest({ ...form, ...change }, now));
  }
  assert.throws(() => buildAdminLaunchRequest({ ...form, openNow: false, opensAt: '2026-09-13T08:00' }, now));
});
