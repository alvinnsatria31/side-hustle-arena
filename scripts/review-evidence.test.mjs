import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReviewerOutput } from '../src/server/reviews/validator.ts';
import { ApiReviewProvider, createReviewProvider, StubReviewProvider } from '../src/server/reviews/model-router.ts';

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
  const result = await provider.review({ profile: 'review', model: 'primary', input: { projectTitle: 'Research', divisionName: 'Strategy', rubric, explanation: sources[0].text, notes: null, attemptNumber: 2, items: [], sources } });
  assert.equal(result.criteria[0].score, 80);
  assert.equal(body.model, 'primary');
  assert.ok(!body.messages[1].content.includes('attemptNumber'));
  assert.equal(body.response_format.type, 'json_object');
});

test('production cannot fall back to fabricated stub scores', () => {
  assert.throws(() => createReviewProvider('review', { APP_ENV: 'production', AI_REVIEW_PROVIDER: 'stub' }), /provider/i);
});

test('development stub chooses a verifiable source after a short explanation', async () => {
  const input = { projectTitle: 'Research', divisionName: 'Strategy', rubric, explanation: 'alpha work', notes: null, attemptNumber: 1, items: [],
    sources: [{ id: 'explanation', text: 'alpha work', kind: 'TEXT', sha256: 'short' }, { ...sources[0], id: 'artifact' }] };
  const result = await new StubReviewProvider().review({ profile: 'review', model: 'stub', input });
  assert.equal(validateReviewerOutput(result, rubric, input.sources).ok, true);
  assert.match(result.criteria[0].evidence[0], /^\[artifact\]/);
});
