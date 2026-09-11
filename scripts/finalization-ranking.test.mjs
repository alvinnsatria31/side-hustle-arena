import assert from "node:assert/strict";
import test from "node:test";

const ranking = await import("../src/server/finalization/ranking.ts");

function finalist(userId, finalScore, finalSubmittedAt) {
  return { userId, finalScore, finalSubmittedAt: new Date(finalSubmittedAt) };
}

test("rank bonus is 200/100/50 on the podium and nothing below it", () => {
  assert.equal(ranking.rankBonus(1), 200);
  assert.equal(ranking.rankBonus(2), 100);
  assert.equal(ranking.rankBonus(3), 50);
  assert.equal(ranking.rankBonus(4), 0);
  assert.equal(ranking.rankBonus(99), 0);
});

test("points are the rounded score plus the rank bonus", () => {
  assert.equal(ranking.pointsForResult(1, 90), 290);
  assert.equal(ranking.pointsForResult(2, 84.5), 185, "a half point rounds up");
  assert.equal(ranking.pointsForResult(3, 70.49), 120);
  assert.equal(ranking.pointsForResult(4, 75), 75);
  assert.equal(ranking.pointsForResult(12, 0), 0);
});

test("better work earns more at the same rank", () => {
  assert.ok(ranking.pointsForResult(5, 95) > ranking.pointsForResult(5, 55));
});

test("an out-of-range or broken score cannot mint or remove points", () => {
  assert.equal(ranking.scorePoints(140), 100);
  assert.equal(ranking.scorePoints(-5), 0);
  assert.equal(ranking.scorePoints(Number.NaN), 0);
  assert.equal(ranking.pointsForResult(1, Number.POSITIVE_INFINITY), 200);
});

test("leaderboard orders by score DESC, submit time ASC", () => {
  const ranked = ranking.rankFinalists([
    finalist("user-b", 80, "2026-09-04T10:00:02Z"),
    finalist("user-a", 90, "2026-09-04T10:00:03Z"),
    finalist("user-c", 80, "2026-09-04T10:00:01Z"),
  ]);
  assert.deepEqual(ranked.map((row) => row.userId), ["user-a", "user-c", "user-b"]);
  assert.deepEqual(ranked.map((row) => row.rank), [1, 2, 3]);
  assert.deepEqual(ranked.map((row) => row.points), [290, 180, 130]);
});

test("identical score and timestamp still ranks deterministically", () => {
  const ranked = ranking.rankFinalists([
    finalist("user-b", 80, "2026-09-04T10:00:00Z"),
    finalist("user-a", 80, "2026-09-04T10:00:00Z"),
  ]);
  assert.deepEqual(ranked.map((row) => row.userId), ["user-a", "user-b"]);
  assert.deepEqual(ranked.map((row) => row.rank), [1, 2]);
});

test("empty week ranks nobody and awards nothing", () => {
  assert.deepEqual(ranking.rankFinalists([]), []);
});
