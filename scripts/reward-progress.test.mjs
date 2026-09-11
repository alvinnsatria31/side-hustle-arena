import assert from "node:assert/strict";
import test from "node:test";

const { rewardProgress, formatPoints } = await import("../src/lib/reward-progress.ts");

// The official ladder (2026-09-11), deliberately out of order.
const ladder = [
  { slug: "cash-500k", title: "CASH REWARD Rp500.000", pointsRequired: 2700 },
  { slug: "notion-kit", title: "Template Notion & Resume Starter Kit", pointsRequired: 300 },
  { slug: "ebook", title: "E-Book Banting Stir Karir & HR Interview Guide", pointsRequired: 600 },
  { slug: "voucher-50", title: "Voucher Diskon 50% Masterclass", pointsRequired: 1000 },
  { slug: "cv-review", title: "1-on-1 CV & Portfolio Review (20 Menit)", pointsRequired: 1500 },
  { slug: "free-pass", title: "100% Free Pass All Masterclass", pointsRequired: 2200 },
];

test("450 points: 150 short of the e-book, 2.250 short of the main reward", () => {
  const progress = rewardProgress(450, ladder);
  assert.equal(progress.next.slug, "ebook");
  assert.equal(progress.next.remaining, 150);
  assert.equal(progress.next.percent, 75);
  assert.equal(progress.main.slug, "cash-500k");
  assert.equal(progress.main.remaining, 2250);
  assert.equal(progress.main.percent, 16);
  assert.equal(progress.reachedCount, 1);
  assert.equal(progress.total, 6);
  assert.equal(progress.mainReached, false);
});

test("a milestone is reached at exactly its threshold", () => {
  const progress = rewardProgress(600, ladder);
  assert.equal(progress.next.slug, "voucher-50");
  assert.equal(progress.reachedCount, 2);
});

test("percent never reads 100 before the target is met", () => {
  assert.equal(rewardProgress(2699, ladder).main.percent, 99);
});

test("past the main reward nothing is next and the main reward is reached", () => {
  const progress = rewardProgress(3000, ladder);
  assert.equal(progress.next, null);
  assert.equal(progress.mainReached, true);
  assert.equal(progress.main.remaining, 0);
  assert.equal(progress.main.percent, 100);
});

test("zero, negative and broken inputs start at the bottom of the ladder", () => {
  assert.equal(rewardProgress(0, ladder).next.slug, "notion-kit");
  assert.equal(rewardProgress(-50, ladder).points, 0);
  assert.equal(rewardProgress(Number.NaN, ladder).points, 0);
});

test("an empty catalog has no targets", () => {
  const progress = rewardProgress(500, []);
  assert.equal(progress.next, null);
  assert.equal(progress.main, null);
  assert.equal(progress.total, 0);
});

test("points are written the Indonesian way", () => {
  assert.equal(formatPoints(2700), "2.700");
});
