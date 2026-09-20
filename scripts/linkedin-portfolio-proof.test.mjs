import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('landing explains that participants manually add Arena work to LinkedIn Projects', () => {
  const page = read('src/app/(landing)/page.tsx');
  assert.match(page, /id="linkedin"/);
  assert.match(page, /tambahkan sendiri ke bagian Projects di LinkedIn/i);
  assert.match(page, /tidak mengunggah otomatis/i);
});

test('portfolio proof is an explicitly labeled sample entry, not a borrowed screenshot', () => {
  const visual = read('src/components/landing/PortfolioProofVisual.tsx');
  assert.match(visual, /Ilustrasi/);
  assert.match(visual, /Sales Insight Brief/);
  assert.match(visual, /Project name/);
  assert.match(visual, /Description/);
  assert.match(visual, /Skills/);
  assert.match(visual, /Media/);
  assert.doesNotMatch(visual, /<Image|Kera Cudmore|UI asli/);
});
