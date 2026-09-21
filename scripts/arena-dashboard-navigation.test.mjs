import assert from 'node:assert/strict';
import test from 'node:test';

const { REWARDS_PATH, appNavLinks, bottomNavLinks, isNavActive } = await import('../src/components/layout/nav-links.ts');

test('participant navigation stays inside Arena and exposes the project workflow', () => {
  const links = appNavLinks();
  assert.deepEqual(links.map(({ label }) => label), [
    'Ringkasan',
    'Jelajahi proyek',
    'Proyekku',
    'Peringkat',
    'Poin & hadiah',
    'Tools',
  ]);
  assert.deepEqual(bottomNavLinks().map(({ label }) => label), [
    'Ringkasan',
    'Proyek',
    'Proyekku',
    'Peringkat',
    'Profil',
  ]);
  assert.ok(
    links.every(
      ({ href }) =>
        href.startsWith('/app/arena') ||
        href.startsWith('/app/profile') ||
        href === 'https://tools.sekolahkarir.id',
    ),
  );
});

test('dashboard and project navigation highlight only the current section', () => {
  assert.equal(isNavActive('/app/arena', '/app/arena'), true);
  assert.equal(isNavActive('/app/arena', '/app/arena/projects'), false);
  assert.equal(isNavActive('/app/arena/projects', '/app/arena/projects/sample'), true);
  assert.equal(isNavActive('/app/arena/my-projects', '/app/arena/my-projects'), true);
  assert.equal(isNavActive(REWARDS_PATH, '/app/arena/rewards'), true);
  assert.equal(isNavActive('/app/arena', REWARDS_PATH), false);
});

test('the top bar keeps Tools as its only promo, drawn after the section links', () => {
  const links = appNavLinks();
  const promos = links.filter((link) => link.highlight);
  assert.deepEqual(promos.map(({ label }) => label), ['Tools']);
  assert.equal(links.at(-1)?.label, 'Tools');
  assert.equal(links.find(({ label }) => label === 'Poin & hadiah')?.href, REWARDS_PATH);
});
