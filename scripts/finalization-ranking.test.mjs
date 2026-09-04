import assert from "node:assert/strict";
import test from "node:test";

const ranking = await import("../src/server/finalization/ranking.ts");

function finalist(userId, finalScore, finalSubmittedAt) {
  return { userId, finalScore, finalSubmittedAt: new Date(finalSubmittedAt) };
}

test("points follow the 300/200/150/100 ladder", () => {
  assert.equal(ranking.pointsForRank(1), 300);
  assert.equal(ranking.pointsForRank(2), 200);
  assert.equal(ranking.pointsForRank(3), 150);
  assert.equal(ranking.pointsForRank(4), 100);
  assert.equal(ranking.pointsForRank(99), 100);
});

test("leaderboard orders by score DESC, submit time ASC", () => {
  const ranked = ranking.rankFinalists([
    finalist("user-b", 80, "2026-09-04T10:00:02Z"),
    finalist("user-a", 90, "2026-09-04T10:00:03Z"),
    finalist("user-c", 80, "2026-09-04T10:00:01Z"),
  ]);
  assert.deepEqual(ranked.map((row) => row.userId), ["user-a", "user-c", "user-b"]);
  assert.deepEqual(ranked.map((row) => row.rank), [1, 2, 3]);
  assert.deepEqual(ranked.map((row) => row.points), [300, 200, 150]);
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
