/**
 * Live, end-to-end exercise of the CV Scanner chain against the real AI
 * provider. Opt-in and billed: it makes a paid model call per fixture, so it
 * is gated on CV_SCAN_LIVE=1 and skips cleanly otherwise (CI stays free).
 *
 *   CV_SCAN_LIVE=1 npm run test:cv:scan:live
 *
 * It walks the same path the API route does, stage by stage, printing for each
 * link what went in, what came out, and how long it took:
 *
 *   bytes -> extractDocumentText -> analyseCvText -> toCvResult
 *
 * and then calls the route's own POST handler once per fixture for a true
 * wall-clock number including request parsing, the feature flag and the rate
 * limiter. The feature flag is forced on in THIS process only; nothing is
 * written to disk or deployed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
process.env.NEXT_PUBLIC_CV_SCANNER_ENABLED = 'true';

const LIVE = process.env.CV_SCAN_LIVE === '1';
const qaFile = (name) => fileURLToPath(new URL(`../qa-files/${name}`, import.meta.url));

const FIXTURES = [
  ['cv-sample.pdf', 'application/pdf'],
  ['cv-sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
];

function ms(started) {
  return `${((performance.now() - started) / 1000).toFixed(1)}s`;
}

function preview(text, n = 140) {
  return JSON.stringify(text.replace(/\s+/g, ' ').trim().slice(0, n) + (text.length > n ? ' ...' : ''));
}

test('CV Scanner: full chain against the live provider', { skip: LIVE ? false : 'set CV_SCAN_LIVE=1 to run' }, async (t) => {
  const { extractDocumentText } = await import('../src/server/reviews/extract.ts');
  const { analyseCvText, toCvResult, resolveCvProviderConfig } = await import('../src/server/cv/analyzer.ts');
  const { resetRateLimit } = await import('../src/server/cv/rate-limit.ts');
  const route = await import('../src/app/api/cv-scan/route.ts');

  const config = resolveCvProviderConfig();
  console.log(`\nprovider: ${config.baseUrl}  model: ${config.model}\n`);

  for (const [name, mime] of FIXTURES) {
    await t.test(name, async () => {
      resetRateLimit();
      const bytes = await readFile(qaFile(name));

      // Stage 1 — extraction
      const t1 = performance.now();
      const text = await extractDocumentText(bytes, name, mime);
      const d1 = ms(t1);
      console.log(`[1] extract     in: ${name} (${bytes.length} B)  out: ${text.length} chars  ${d1}`);
      console.log(`              text: ${preview(text)}`);
      assert.ok(text.trim().length >= 120);

      // Stage 2 — analysis (the paid call)
      const t2 = performance.now();
      const analysis = await analyseCvText(text);
      const d2 = ms(t2);
      console.log(`[2] analyse     in: ${text.length} chars  out: score ${analysis.overallScore}, ${analysis.metrics.quality}/${analysis.metrics.ats}/${analysis.metrics.impact}/${analysis.metrics.evidence}  ${d2}`);
      console.log(`         strengths: ${analysis.strengths.length}  improvements: ${analysis.improvements.length}  skills: ${analysis.skills.length}  qChecks: ${analysis.qualityChecks.length}  atsChecks: ${analysis.atsChecks.length}  impactExamples: ${analysis.impactExamples.length}`);
      console.log(`      improvements: ${JSON.stringify(analysis.improvements)}`);
      console.log(`            skills: ${analysis.skills.map((s) => `${s.skill}=${s.level}`).join(', ')}`);
      if (analysis.impactExamples.length) {
        console.log(`     impact before: ${JSON.stringify(analysis.impactExamples[0].before)}`);
        console.log(`     impact after : ${JSON.stringify(analysis.impactExamples[0].after)}`);
      }

      // Stage 3 — shaping
      const t3 = performance.now();
      const result = toCvResult(analysis, name);
      console.log(`[3] toCvResult  in: analysis  out: ${result.statusLabel}, ${result.metrics.filter((m) => m.weak).map((m) => m.label).join(' + ') || 'no'} flagged weak  ${ms(t3)}`);

      // Structural checks on the rendered result
      assert.equal(result.score, analysis.overallScore);
      assert.equal(result.metrics.length, 4);
      assert.deepEqual(result.metrics.map((m) => m.label), ['CV Quality', 'ATS Readiness', 'Impact', 'Career Evidence']);
      assert.ok(result.evidence.length >= 1 && result.strengths.length >= 1 && result.improvements.length >= 1);
      assert.equal(result.statusLabel, result.statusLabel.toUpperCase());
      assert.equal(result.fileName, name);
      assert.ok(!Number.isNaN(Date.parse(result.analyzedAt)));

      // Stage 4 — the route handler, end to end
      resetRateLimit();
      const form = new FormData();
      form.append('file', new File([bytes], name, { type: mime }));
      const request = new Request('https://arena.local/api/cv-scan', {
        method: 'POST',
        body: form,
        headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
      });
      const t4 = performance.now();
      const response = await route.POST(request);
      const d4 = ms(t4);
      const body = await response.json();
      console.log(`[4] POST route  in: multipart ${name}  out: HTTP ${response.status}  ${d4}`);
      assert.equal(response.status, 200, `route returned ${response.status}: ${JSON.stringify(body)}`);
      assert.equal(body.data.result.fileName, name);
      assert.ok(body.data.result.metrics.length === 4);

      console.log(`    --- ${name}: extract ${d1} + analyse ${d2}  |  route wall clock ${d4} ---\n`);
    });
  }
});
