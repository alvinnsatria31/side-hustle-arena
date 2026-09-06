import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { analyseCvText, resolveCvProviderConfig, toCvResult } from '../src/server/cv/analyzer.ts';
import { checkRateLimit, clientKey, resetRateLimit } from '../src/server/cv/rate-limit.ts';
import { extractDocumentText } from '../src/server/reviews/extract.ts';

const qaFile = (name) => fileURLToPath(new URL(`../qa-files/${name}`, import.meta.url));

const CONFIG = { baseUrl: 'https://ai.example.test/v1', apiKey: 'k', model: 'm' };

/** A full, valid model reply; individual tests spoil one field at a time. */
function reply(overrides = {}) {
  return {
    overallScore: 72,
    statusLabel: 'good foundation',
    metrics: { quality: 82, ats: 78, impact: 66, evidence: 48 },
    strengths: ['Struktur CV jelas.'],
    improvements: ['Impact belum pakai angka.'],
    skills: [{ skill: 'Excel', level: 'cukup', note: 'Ada pengalaman, belum ada output.' }],
    qualityChecks: [{ label: 'Struktur & hierarki', pass: true, note: 'Section jelas.' }],
    atsChecks: [{ label: 'Format terbaca mesin', pass: true, note: 'Tanpa tabel kompleks.' }],
    impactExamples: [{ before: 'Membuat laporan bulanan.', after: 'Membuat laporan bulanan dipakai 3 tim.' }],
    ...overrides,
  };
}

function transportReturning(payload) {
  return async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: 'stop' }] }), {
      status: 200,
    });
}

const CV_TEXT = 'Alvin Pratama. Data Analyst. '.repeat(12);

test('a well-formed model reply becomes the result the page renders', async () => {
  const analysis = await analyseCvText(CV_TEXT, CONFIG, transportReturning(reply()));
  const result = toCvResult(analysis, 'cv.pdf', new Date('2026-09-06T00:00:00Z'));

  assert.equal(result.score, 72);
  assert.equal(result.statusLabel, 'GOOD FOUNDATION', 'status is upper-cased server-side');
  assert.equal(result.fileName, 'cv.pdf');
  assert.deepEqual(
    result.metrics.map((m) => m.label),
    ['CV Quality', 'ATS Readiness', 'Impact', 'Career Evidence'],
    'labels come from the server, never from the model',
  );
  // Only the metric below the weak threshold is flagged, so the UI highlights one.
  assert.deepEqual(result.metrics.map((m) => Boolean(m.weak)), [false, false, false, true]);
  assert.equal(result.qualityChecks.length, 1);
  assert.equal(result.impactExamples.length, 1);
});

test('an out-of-range score is rejected rather than shown', async () => {
  await assert.rejects(
    () => analyseCvText(CV_TEXT, CONFIG, transportReturning(reply({ overallScore: 140 }))),
    /Invalid|too_big|expected/i,
  );
});

test('an unknown evidence level is rejected', async () => {
  await assert.rejects(
    () => analyseCvText(CV_TEXT, CONFIG, transportReturning(reply({ skills: [{ skill: 'X', level: 'legendaris', note: 'nope' }] }))),
    /Invalid|invalid_value|expected/i,
  );
});

test('a document too short to judge never reaches the model', async () => {
  let called = false;
  const spy = async () => {
    called = true;
    return new Response('{}', { status: 200 });
  };
  await assert.rejects(() => analyseCvText('halo', CONFIG, spy), /terlalu pendek/i);
  assert.equal(called, false, 'no paid call is made for an unusable document');
});

test('an empty impactExamples array is allowed: nothing to rewrite is a valid finding', async () => {
  const analysis = await analyseCvText(CV_TEXT, CONFIG, transportReturning(reply({ impactExamples: [] })));
  assert.deepEqual(toCvResult(analysis, 'cv.pdf').impactExamples, []);
});

test('the rate limiter allows a burst then refuses with a retry hint', () => {
  resetRateLimit();
  const now = Date.now();
  for (let i = 0; i < 5; i += 1) {
    assert.equal(checkRateLimit('1.2.3.4', now).allowed, true, `call ${i + 1} should pass`);
  }
  const blocked = checkRateLimit('1.2.3.4', now);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  // A different caller is unaffected, and the window eventually reopens.
  assert.equal(checkRateLimit('5.6.7.8', now).allowed, true);
  assert.equal(checkRateLimit('1.2.3.4', now + 61 * 60 * 1000).allowed, true);
});

test('the client key reads the first forwarded address, not the whole chain', () => {
  const request = new Request('https://arena.example.test/api/cv-scan', {
    headers: { 'x-forwarded-for': '203.0.113.9, 70.41.3.18' },
  });
  assert.equal(clientKey(request), '203.0.113.9');
  assert.equal(clientKey(new Request('https://arena.example.test/api/cv-scan')), 'unknown');
});

// --- Extraction: the one link the offline suite could not previously prove ---
//
// These run the real extractor (officeparser -> pdfjs / OOXML) against fixtures
// that actually carry text, built by scripts/cv-fixtures.mjs. The old e2e
// fixture (qa-files/deliverable.pdf) is a structurally valid but contentless
// page: the extractor refusing it proved the guard, not the extraction.

/** Lines of the reference plaintext that must survive extraction verbatim. */
const CV_MARKERS = [
  'RANGGA WIJAYA',
  'Data Analyst Intern - PT Niaga Digital Nusantara',
  'menurunkan waktu penyusunan laporan mingguan dari 6 jam menjadi 1 jam (-83%).',
  'IPK 3.42 / 4.00',
  'SQL, Python (pandas, scikit-learn), R, Microsoft Excel, Tableau, Power BI, Git',
  'Kredensial: coursera.org/verify/XXXXXXX',
];

/** Collapse runs of whitespace so PDF line-break quirks do not defeat a match. */
const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/** Fraction of characters that are plain readable text, not control/replacement junk. */
function readableRatio(text) {
  if (!text.length) return 0;
  const clean = text.match(/[\p{L}\p{N}\p{P}\p{Z}\n]/gu)?.length ?? 0;
  return clean / text.length;
}

for (const [name, mime] of [
  ['cv-sample.pdf', 'application/pdf'],
  ['cv-sample.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
]) {
  test(`extractor pulls real CV text from ${name}`, async () => {
    const bytes = await readFile(qaFile(name));
    const text = await extractDocumentText(bytes, name, mime);
    const flat = collapse(text);

    // Not empty, not a stub: a one-page CV is comfortably over 800 characters.
    assert.ok(text.length > 800, `only ${text.length} chars extracted from ${name}`);
    // Not garbage: no replacement chars, and almost every character is readable.
    assert.ok(!text.includes('�'), `${name} extraction contains replacement characters`);
    assert.ok(
      readableRatio(text) > 0.99,
      `${name} extraction is only ${(readableRatio(text) * 100).toFixed(1)}% readable text`,
    );
    // Distinctive content from every section survived, in order.
    let cursor = 0;
    for (const marker of CV_MARKERS) {
      const at = flat.indexOf(collapse(marker), cursor);
      assert.ok(at >= 0, `${name} extraction is missing or reorders: ${marker}`);
      cursor = at;
    }
  });
}

test('PDF and DOCX fixtures extract to the same CV', async () => {
  const [pdf, docx] = await Promise.all([
    extractDocumentText(await readFile(qaFile('cv-sample.pdf')), 'cv-sample.pdf', 'application/pdf'),
    extractDocumentText(
      await readFile(qaFile('cv-sample.docx')),
      'cv-sample.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ),
  ]);
  // Word-level equality: whitespace and blank-line handling legitimately differ
  // between the two formats, the words themselves must not.
  const words = (t) => collapse(t).replace(/\s+/g, ' ');
  assert.equal(words(pdf), words(docx));
});

test('an extracted fixture is long enough to reach the analyzer', async () => {
  // The analyzer floor is 120 characters of trimmed text; a real CV clears it
  // by more than an order of magnitude. This ties the two links together:
  // whatever the extractor returns here is what analyseCvText would receive.
  const text = await extractDocumentText(
    await readFile(qaFile('cv-sample.pdf')),
    'cv-sample.pdf',
    'application/pdf',
  );
  assert.ok(text.trim().length >= 120);
});

test('the contentless e2e fixture is still refused by the extractor guard', async () => {
  // qa-files/deliverable.pdf has a page tree but no /Contents. Rejecting it is
  // correct: there is no text to analyse. Kept so a regression that starts
  // returning junk for empty PDFs is caught.
  const bytes = await readFile(qaFile('deliverable.pdf'));
  await assert.rejects(
    () => extractDocumentText(bytes, 'deliverable.pdf', 'application/pdf'),
    /insufficient readable text|Invalid document/i,
  );
});

test('a generous model gets trimmed, not thrown away', async () => {
  // Measured 1 run in 5 on gpt-oss-120b: asked for at most 6 skills, returned
  // 7. Rejecting the whole analysis over one extra row is the wrong trade —
  // the cap is a layout decision, not a validity one.
  const analysis = await analyseCvText(CV_TEXT, CONFIG, transportReturning(reply({
    skills: Array.from({ length: 9 }, (_, i) => ({ skill: `Skill ${i}`, level: 'cukup', note: 'Cukup terbukti.' })),
    strengths: Array.from({ length: 7 }, (_, i) => `Kekuatan nomor ${i}.`),
    qualityChecks: Array.from({ length: 6 }, (_, i) => ({ label: `Cek ${i}`, pass: true, note: 'Terpenuhi.' })),
    impactExamples: Array.from({ length: 5 }, (_, i) => ({ before: `Baris asli ${i} yang panjang.`, after: `Baris ditulis ulang ${i}.` })),
  })));

  assert.equal(analysis.skills.length, 6);
  assert.equal(analysis.strengths.length, 4);
  assert.equal(analysis.qualityChecks.length, 4);
  assert.equal(analysis.impactExamples.length, 2);
  // Trimming keeps the front of the list, which is the model's own ordering.
  assert.equal(analysis.skills[0].skill, 'Skill 0');
});

test('an empty required list is still refused', async () => {
  // Trimming is generosity about too many, not about none: a result page with
  // zero strengths is a broken page, so this stays a hard failure.
  await assert.rejects(
    analyseCvText(CV_TEXT, CONFIG, transportReturning(reply({ strengths: [] }))),
    /invalid|too small|expected/i,
  );
});

test('a runaway list is refused rather than silently truncated', async () => {
  await assert.rejects(
    analyseCvText(CV_TEXT, CONFIG, transportReturning(reply({
      skills: Array.from({ length: 200 }, () => ({ skill: 'X', level: 'cukup', note: 'Catatan.' })),
    }))),
    /too big|invalid|expected/i,
  );
});

test('one malformed reply is retried, and the second answer is used', async () => {
  // ~1 real scan in 14 came back valid JSON of the wrong shape. A retry costs
  // a few seconds out of a 45s budget and turns that into a non-event.
  let calls = 0;
  const flaky = async () => {
    calls += 1;
    const content = calls === 1 ? JSON.stringify(['not', 'an', 'object']) : JSON.stringify(reply());
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), { status: 200 });
  };

  const analysis = await analyseCvText(CV_TEXT, CONFIG, flaky);
  assert.equal(calls, 2);
  assert.equal(analysis.overallScore, 72);
});

test('two malformed replies give up rather than loop', async () => {
  let calls = 0;
  const broken = async () => {
    calls += 1;
    return new Response(JSON.stringify({ choices: [{ message: { content: '[]' }, finish_reason: 'stop' }] }), { status: 200 });
  };

  await assert.rejects(analyseCvText(CV_TEXT, CONFIG, broken));
  assert.equal(calls, 2, 'exactly one retry, never an unbounded loop');
});

test('an exhausted quota is not retried', async () => {
  // Hammering a 429 makes the quota worse and burns the caller's time budget.
  let calls = 0;
  const throttled = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 });
  };

  await assert.rejects(analyseCvText(CV_TEXT, CONFIG, throttled), /429/);
  assert.equal(calls, 1);
});

test('a spent time budget is not retried', async () => {
  let calls = 0;
  const slow = async () => {
    calls += 1;
    const error = new Error('The operation was aborted due to timeout');
    error.name = 'TimeoutError';
    throw error;
  };

  await assert.rejects(analyseCvText(CV_TEXT, CONFIG, slow), /timeout/i);
  assert.equal(calls, 1);
});

// --- provider selection -----------------------------------------------------
// The scan may run on a different provider than the Arena reviewer: the
// reviewer grades in a background worker where thinking time is free, the scan
// runs inside a request the platform will kill.

const REVIEWER_ENV = {
  AI_REVIEW_PROVIDER: 'openai-compatible',
  AI_API_BASE_URL: 'https://reviewer.example/v1',
  AI_API_KEY: 'reviewer-key',
  AI_REVIEW_MODEL: 'reviewer-model',
};

test('the scan borrows the reviewer provider when nothing is overridden', () => {
  const config = resolveCvProviderConfig({ ...REVIEWER_ENV });
  assert.deepEqual(config, {
    baseUrl: 'https://reviewer.example/v1',
    apiKey: 'reviewer-key',
    model: 'reviewer-model',
  });
});

test('AI_CV_MODEL alone swaps the model but keeps the provider', () => {
  const config = resolveCvProviderConfig({ ...REVIEWER_ENV, AI_CV_MODEL: 'fast-model' });
  assert.equal(config.baseUrl, 'https://reviewer.example/v1');
  assert.equal(config.model, 'fast-model');
});

test('AI_CV_API_BASE_URL moves the scan to its own provider, key and all', () => {
  const config = resolveCvProviderConfig({
    ...REVIEWER_ENV,
    AI_CV_API_BASE_URL: 'https://api.groq.com/openai/v1',
    AI_CV_API_KEY: 'scan-key',
    AI_CV_MODEL: 'llama-3.3-70b-versatile',
  });
  assert.deepEqual(config, {
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: 'scan-key',
    model: 'llama-3.3-70b-versatile',
  });
});

test("its own provider does not answer to the reviewer's provider flag", () => {
  // AI_REVIEW_PROVIDER describes the reviewer. Once the scan has its own
  // endpoint and key, that flag has no authority over it — requiring it anyway
  // meant a fully configured scanner refused to run, indistinguishable from a
  // provider outage.
  const config = resolveCvProviderConfig({
    AI_REVIEW_PROVIDER: 'stub',
    AI_CV_API_BASE_URL: 'https://api.groq.com/openai/v1',
    AI_CV_API_KEY: 'scan-key',
    AI_CV_MODEL: 'openai/gpt-oss-120b',
  });
  assert.equal(config.baseUrl, 'https://api.groq.com/openai/v1');
  assert.equal(config.model, 'openai/gpt-oss-120b');
});

test('borrowing the reviewer provider still respects its flag', () => {
  // The coupling is correct in this direction: with no endpoint of its own the
  // scan runs on the reviewer's provider, so the reviewer's flag governs.
  assert.throws(
    () => resolveCvProviderConfig({
      AI_REVIEW_PROVIDER: 'stub',
      AI_API_BASE_URL: 'https://reviewer.example/v1',
      AI_API_KEY: 'reviewer-key',
      AI_REVIEW_MODEL: 'reviewer-model',
    }),
    /not configured/i,
  );
});

test('a scan endpoint without its own key is refused, never paired with the reviewer credential', () => {
  // Sending the reviewer's key to another company's endpoint would hand that
  // host a credential it was never meant to see.
  assert.throws(
    () => resolveCvProviderConfig({ ...REVIEWER_ENV, AI_CV_API_BASE_URL: 'https://api.groq.com/openai/v1' }),
    /not configured/i,
  );
});

test('the scan provider must be HTTPS', () => {
  assert.throws(
    () => resolveCvProviderConfig({ ...REVIEWER_ENV, AI_CV_API_BASE_URL: 'http://api.groq.com/openai/v1', AI_CV_API_KEY: 'k' }),
    /HTTPS/i,
  );
});
