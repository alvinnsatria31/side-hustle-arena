import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReviewerOutput } from '../src/server/reviews/validator.ts';
import { ApiReviewProvider, createReviewProvider, isApiReviewProvider, StubReviewProvider } from '../src/server/reviews/model-router.ts';
import { normaliseReviewerOutput, reviewerOutputSchema } from '../src/server/reviews/review-schema.ts';

const id = '00000000-0000-4000-8000-000000000001';
const rubric = [{ id, name: 'Research', weight: 100, maxScore: 100, description: null, reviewInstruction: null }];
const sources = [{ id: 'explanation', text: 'We interviewed twelve customers about weekly spending.', sha256: 'abc', kind: 'TEXT' }];
const output = { criteria: [{ criterionId: id, score: 80, evidence: ['[explanation] interviewed twelve customers'], issues: [], confidence: 0.9 }], strengths: [], priorityImprovements: [], confidence: 0.9 };

test('evidence must quote a real source; well-shaped fictional evidence fails', () => {
  assert.equal(validateReviewerOutput(output, rubric, sources).ok, true);
  for (const evidence of ['[unknown] interviewed twelve customers', '[explanation] interviewed one million customers', 'fictional but formatted evidence']) {
    const value = { ...output, criteria: [{ ...output.criteria[0], evidence: [evidence] }] };
    assert.equal(validateReviewerOutput(value, rubric, sources).ok, false);
  }
});

test('configured provider sends blind JSON and parses provider output', async () => {
  let body;
  const provider = new ApiReviewProvider({ baseUrl: 'https://provider.example/v1', apiKey: 'test', models: { review: 'primary', judge: 'judge', validate: 'validate', generation: 'generate' } }, async (url, init) => {
    assert.equal(url, 'https://provider.example/v1/chat/completions');
    body = JSON.parse(init.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify(output) }, finish_reason: 'stop' }] });
  });
  const brief = { caseBackground: 'Retention declined last quarter.', roleDescription: 'Act as an analyst.', mission: 'Find the cause.', objective: 'Recommend a measurable response.' };
  const evidenceLimits = ['Links are frozen text and do not prove interactive behaviour.'];
  const result = await provider.review({ profile: 'review', model: 'primary', input: { projectTitle: 'Research', divisionName: 'Strategy', brief, rubric, explanation: sources[0].text, notes: null, attemptNumber: 2, items: [], sources, evidenceLimits } });
  assert.equal(result.criteria[0].score, 80);
  assert.equal(body.model, 'primary');
  const gradingInput = JSON.parse(body.messages[1].content);
  assert.deepEqual(gradingInput.brief, brief);
  assert.equal(gradingInput.explanation, sources[0].text);
  assert.deepEqual(gradingInput.evidenceLimits, evidenceLimits);
  assert.ok(!('attemptNumber' in gradingInput));
  assert.equal(body.response_format.type, 'json_object');
});

test('production cannot fall back to fabricated stub scores', () => {
  assert.throws(() => createReviewProvider('review', { APP_ENV: 'production', AI_REVIEW_PROVIDER: 'stub' }), /provider/i);
});

test('the second judge builds on the provider name production actually sets', () => {
  // The live container runs AI_REVIEW_PROVIDER=openai. The factory used to
  // accept only 'openai-compatible', so every path that needs an in-process
  // provider — the second judge above all — threw before it called anything.
  const base = { APP_ENV: 'production', AI_API_BASE_URL: 'https://provider.example/v1', AI_API_KEY: 'k', AI_JUDGE_MODEL: 'judge' };
  for (const AI_REVIEW_PROVIDER of ['openai', 'openai-compatible']) {
    const provider = createReviewProvider('judge', { ...base, AI_REVIEW_PROVIDER });
    assert.ok(provider instanceof ApiReviewProvider, `${AI_REVIEW_PROVIDER} must reach the API provider`);
  }
  // Widened, not opened: an unknown name is still a misconfiguration, and a
  // configured name with no judge model still fails on the model, not silently.
  assert.throws(() => createReviewProvider('judge', { ...base, AI_REVIEW_PROVIDER: 'anthropic-native' }), /provider/i);
  assert.throws(() => createReviewProvider('judge', { ...base, AI_REVIEW_PROVIDER: 'openai', AI_JUDGE_MODEL: '' }), /judge model/i);
});

test('isApiReviewProvider answers the same question the factory asks', () => {
  assert.equal(isApiReviewProvider({ AI_REVIEW_PROVIDER: 'openai' }), true);
  assert.equal(isApiReviewProvider({ AI_REVIEW_PROVIDER: 'openai-compatible' }), true);
  assert.equal(isApiReviewProvider({ AI_REVIEW_PROVIDER: 'stub' }), false);
  assert.equal(isApiReviewProvider({}), false);
});

test('development stub chooses a verifiable source after a short explanation', async () => {
  const input = { projectTitle: 'Research', divisionName: 'Strategy', rubric, explanation: 'alpha work', notes: null, attemptNumber: 1, items: [],
    sources: [{ id: 'explanation', text: 'alpha work', kind: 'TEXT', sha256: 'short' }, { ...sources[0], id: 'artifact' }] };
  const result = await new StubReviewProvider().review({ profile: 'review', model: 'stub', input });
  assert.equal(validateReviewerOutput(result, rubric, input.sources).ok, true);
  assert.match(result.criteria[0].evidence[0], /^\[artifact\]/);
});

test('a real model returned issues as a bare string; shape is repaired, meaning is not', () => {
  // The exact failure seen from deepseek/deepseek-v4-flash on the first live
  // run: `issues` came back as a string, which rejected an otherwise correct
  // set of scores and spent one of the job's automation attempts.
  const fromModel = {
    criteria: [{ criterionId: id, score: 80, evidence: '[explanation] interviewed twelve customers', issues: 'Tidak ada pembanding.', confidence: 0.9 }],
    strengths: 'Alur runtut.',
    priorityImprovements: [],
    confidence: 0.9,
  };
  assert.equal(reviewerOutputSchema.safeParse(fromModel).success, false, 'raw model output is what used to fail');

  const repaired = reviewerOutputSchema.parse(normaliseReviewerOutput(fromModel));
  assert.deepEqual(repaired.criteria[0].issues, ['Tidak ada pembanding.']);
  assert.deepEqual(repaired.criteria[0].evidence, ['[explanation] interviewed twelve customers']);
  assert.deepEqual(repaired.strengths, ['Alur runtut.']);
  assert.equal(repaired.criteria[0].score, 80, 'a score must never be rewritten');
  assert.equal(validateReviewerOutput(repaired, rubric, sources).ok, true);

  // Over-long advisory lists are capped rather than failing the whole review.
  const many = normaliseReviewerOutput({ ...fromModel, strengths: Array.from({ length: 14 }, (_, i) => `poin ${i}`) });
  assert.equal(many.strengths.length, 10);

  // Nothing that carries meaning is coerced, and nothing is invented.
  for (const bad of [
    { ...fromModel, criteria: [{ ...fromModel.criteria[0], score: 'delapan puluh' }] },
    { ...fromModel, criteria: [{ ...fromModel.criteria[0], confidence: 'tinggi' }] },
    { ...fromModel, criteria: [{ ...fromModel.criteria[0], evidence: 42 }] },
  ]) {
    assert.equal(reviewerOutputSchema.safeParse(normaliseReviewerOutput(bad)).success, false);
  }
  assert.equal(normaliseReviewerOutput(null), null);

  // Too many criteria means the model invented some; that must still surface.
  const invented = normaliseReviewerOutput({ ...fromModel, criteria: Array.from({ length: 25 }, () => fromModel.criteria[0]) });
  assert.equal(invented.criteria.length, 25, 'criteria are never silently truncated');
  assert.equal(reviewerOutputSchema.safeParse(invented).success, false);
});
