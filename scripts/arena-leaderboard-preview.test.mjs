import assert from 'node:assert/strict';
import test from 'node:test';

const { myWeekRanking } = await import('../src/lib/dashboard-view.ts');

const history = [
  { week: { weekCode: 'W12' }, ranking: { rank: 7, finalScore: 82 } },
  { week: { weekCode: 'W11' }, ranking: { rank: 2, finalScore: 91 } },
  { week: { weekCode: 'W10' }, ranking: null },
];

test('returns my rank and score for the requested week', () => {
  assert.deepEqual(myWeekRanking(history, 'W12'), { rank: 7, finalScore: 82 });
});

test('returns null when the week has no ranking', () => {
  assert.equal(myWeekRanking(history, 'W10'), null);
  assert.equal(myWeekRanking(history, 'W09'), null);
});
