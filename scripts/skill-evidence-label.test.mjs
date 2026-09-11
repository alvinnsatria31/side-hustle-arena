// How the profile words a skill score (audit W6). Pure function plus a source guard.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { presentSkillEvidence } from '../src/lib/skill-evidence-label.ts';

test('criterion-measured evidence shows its score as a skill score', () => {
  const view = presentSkillEvidence({ score: 82, attribution: 'CRITERION' });
  assert.equal(view.measured, true);
  assert.equal(view.scoreText, '82/100');
  assert.equal(view.scoreLabel, 'Skor skill terukur');
  assert.equal(view.badge, null);
});

test('project-attributed evidence is labelled as the project score with its context', () => {
  const view = presentSkillEvidence({ score: 82, attribution: 'PROJECT' });
  assert.equal(view.measured, false);
  assert.equal(view.scoreText, 'Skor project: 82/100');
  assert.equal(view.scoreLabel, 'Konteks pengerjaan');
  assert.equal(view.badge, 'Belum diuji khusus');
  assert.match(view.note, /bukan skor skill/);
});

test('an unrecognised attribution is treated as unmeasured, as Career Report does', () => {
  assert.equal(presentSkillEvidence({ score: 60, attribution: 'LEGACY' }).measured, false);
});

test('the profile card renders evidence through the attribution rule, never a raw score', async () => {
  const source = await readFile(new URL('../src/components/arena/ParticipantProfile.tsx', import.meta.url), 'utf8');
  assert.match(source, /presentSkillEvidence\(item\)/);
  assert.equal(source.includes('{item.score}/100'), false);
});
