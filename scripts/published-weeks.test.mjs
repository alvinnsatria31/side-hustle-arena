// Archived weeks keep their announced results (audit W3). Pure functions only.
import assert from 'node:assert/strict';
import test from 'node:test';
import { PUBLISHED_WEEK_STATUSES, isPublishedWeekStatus } from '../src/server/arena/published-weeks.ts';
import { buildCareerReport } from '../src/server/career/report.ts';

const points = { balance: 0, lifetimeEarned: 0 };
const entry = (id, weekStatus, score = 80) => ({
  id, status: 'SUBMITTED', project: { slug: id, title: id, division: 'Data' },
  week: { weekCode: id, status: weekStatus, finalizedAt: '2026-09-01T00:00:00.000Z' },
  ranking: { finalScore: score, rank: 1, pointsAwarded: 300 },
  sealed: !isPublishedWeekStatus(weekStatus),
});

test('results are announced for FINALIZED and ARCHIVED weeks only', () => {
  assert.deepEqual([...PUBLISHED_WEEK_STATUSES], ['FINALIZED', 'ARCHIVED']);
  for (const status of ['DRAFT', 'PREVIEW', 'SCHEDULED', 'OPEN', 'CLOSED', 'FINALIZING', 'FAILED']) {
    assert.equal(isPublishedWeekStatus(status), false, status);
  }
});

test('archiving a week keeps its project and skill evidence in the Career Report', () => {
  const skillEvidence = [
    { id: 'e1', skillId: 'sql', name: 'SQL', score: 70, attribution: 'CRITERION', criterionCount: 1, projectSlug: 'old', weekCode: 'old' },
    { id: 'e2', skillId: 'sql', name: 'SQL', score: 90, attribution: 'CRITERION', criterionCount: 1, projectSlug: 'new', weekCode: 'new' },
  ];
  const report = buildCareerReport({ history: [entry('new', 'FINALIZED', 90), entry('old', 'ARCHIVED', 70)], skillEvidence, points });
  assert.equal(report.projectsCompleted, 2);
  assert.deepEqual(report.history.map((row) => row.id), ['new', 'old']);
  assert.equal(report.skills.length, 1);
  assert.equal(report.skills[0].score, 80);
  assert.equal(report.skills[0].measuredCount, 2);
});

test('an archived week does not revive a voided enrollment', () => {
  const report = buildCareerReport({ history: [{ ...entry('void', 'ARCHIVED'), status: 'VOIDED' }], skillEvidence: [], points });
  assert.equal(report.projectsCompleted, 0);
});
