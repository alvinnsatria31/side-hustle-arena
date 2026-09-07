import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCareerReport } from '../src/server/career/report.ts';

const empty = () => ({ history: [], skillEvidence: [], points: { balance: 0, lifetimeEarned: 0 } });
function entry(id, score, finalized = true) {
  return { id, status: 'SUBMITTED', project: { slug: id, title: id, division: 'Data' },
    week: { weekCode: id, status: finalized ? 'FINALIZED' : 'CLOSED', finalizedAt: '2026-09-01T00:00:00.000Z' },
    ranking: { finalScore: score, rank: 1, pointsAwarded: 300 }, sealed: !finalized };
}

test('new participant has no invented achievements or career readiness percentage', () => {
  const report = buildCareerReport(empty());
  assert.equal(report.projectsCompleted, 0);
  assert.equal(report.averageScore, null);
  assert.equal(report.previousAverage, null);
  assert.equal(report.scoreChange, null);
  assert.deepEqual(report.skills, []);
  assert.equal(report.points.balance, 0);
});

test('sealed and voided results never contribute to the report', () => {
  const report = buildCareerReport({ ...empty(), history: [entry('sealed', 100, false), { ...entry('void', 100), status: 'VOIDED' }, entry('real', 60)] });
  assert.equal(report.projectsCompleted, 1);
  assert.equal(report.averageScore, 60);
  assert.equal(report.scoreChange, null);
  assert.deepEqual(report.history.map(h => h.id), ['real']);
});

test('trend compares current mean with mean before latest result, including a decline', () => {
  const report = buildCareerReport({ ...empty(), history: [entry('new', 60), entry('old', 80)], points: { balance: 200, lifetimeEarned: 600 } });
  assert.equal(report.averageScore, 70);
  assert.equal(report.previousAverage, 80);
  assert.equal(report.scoreChange, -10);
  assert.equal(report.points.balance, 200);
  assert.equal(report.points.lifetimeEarned, 600);
});

test('skills average actual evidence, stay tied to final projects, and do not infer absent skills', () => {
  const report = buildCareerReport({ ...empty(), history: [entry('a', 70), entry('b', 80)], skillEvidence: [
    { id: '1', skillId: 'sql', name: 'SQL', score: 60, projectSlug: 'a', weekCode: 'a', summary: 'query' },
    { id: '2', skillId: 'sql', name: 'SQL', score: 80, projectSlug: 'b', weekCode: 'b', summary: 'join' },
    { id: '3', skillId: 'secret', name: 'Sealed', score: 100, projectSlug: 'hidden', weekCode: 'hidden' },
  ] });
  assert.equal(report.skills.length, 1);
  assert.equal(report.skills[0].score, 70);
  assert.equal(report.skills[0].evidenceCount, 2);
  assert.deepEqual(report.history[0].skills, ['SQL']);
});

// --- CV joined to the report (audit finding 6) -------------------------------
//
// The CV is a self-description; the Arena is observed work. The join exists to
// show a participant which of their own claims the Arena can back — never to
// blend the two into one number.

const cvScan = (evidence, overrides = {}) => ({
  score: 72, statusLabel: 'GOOD FOUNDATION', fileName: 'cv.pdf',
  analyzedAt: '2026-09-06T00:00:00.000Z', evidence, ...overrides,
});

test('a participant with no CV still gets a complete report', () => {
  assert.equal(buildCareerReport(empty()).cv, null);
  assert.equal(buildCareerReport({ ...empty(), cv: null }).cv, null);
});

test('CV claims are matched against evidenced skills without merging the scores', () => {
  const report = buildCareerReport({
    ...empty(),
    history: [entry('a', 70), entry('b', 80)],
    skillEvidence: [
      { id: '1', skillId: 'sql', name: 'SQL', score: 60, projectSlug: 'a', weekCode: 'a' },
      { id: '2', skillId: 'sql', name: 'SQL', score: 80, projectSlug: 'b', weekCode: 'b' },
    ],
    cv: cvScan([
      { skill: 'sql', level: 'kuat', note: 'dipakai harian' },
      { skill: 'Public Speaking', level: 'cukup', note: 'presentasi kampus' },
    ]),
  });

  // The evidenced side is untouched by the CV: still the mean of 60 and 80.
  assert.equal(report.skills.length, 1);
  assert.equal(report.skills[0].score, 70);
  assert.equal(report.averageScore, 75, 'project scores must not absorb the CV score');
  assert.equal(report.cv.score, 72, 'the CV score is carried through, not blended');

  // Case and spacing differences still count as the same skill.
  const [sql, speaking] = report.cv.claimedSkills;
  assert.equal(sql.evidencedScore, 70);
  assert.equal(sql.evidenceCount, 2);

  // A claim the Arena has never reviewed is reported as unevidenced, not false.
  assert.equal(speaking.evidencedScore, null);
  assert.equal(speaking.evidenceCount, 0);

  assert.equal(report.cv.corroborated, 1);
  assert.equal(report.cv.unevidenced, 1);
});

test('CV claims cannot borrow evidence from sealed or unfinalized work', () => {
  const report = buildCareerReport({
    ...empty(),
    history: [entry('sealed', 90, false)],
    skillEvidence: [{ id: '1', skillId: 'sql', name: 'SQL', score: 90, projectSlug: 'sealed', weekCode: 'sealed' }],
    cv: cvScan([{ skill: 'SQL', level: 'kuat', note: 'klaim' }]),
  });
  assert.deepEqual(report.skills, [], 'sealed evidence stays out of the report');
  assert.equal(report.cv.claimedSkills[0].evidenceCount, 0, 'a CV claim must not resurrect sealed evidence');
  assert.equal(report.cv.corroborated, 0);
});
