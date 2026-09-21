import assert from 'node:assert/strict';
import test from 'node:test';

const { appNavLinks, bottomNavLinks, isNavActive } = await import('../src/components/layout/nav-links.ts');

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
  assert.equal(isNavActive('/app/profile#rewards', '/app/profile'), true);
});

test('sidebar groups arena links above secondary links', () => {
  const links = appNavLinks();
  const arena = links.filter((l) => l.section !== 'lainnya');
  const secondary = links.filter((l) => l.section === 'lainnya');
  assert.deepEqual(arena.map(({ label }) => label), [
    'Ringkasan',
    'Jelajahi proyek',
    'Proyekku',
    'Peringkat',
  ]);
  assert.deepEqual(secondary.map(({ label }) => label), ['Poin & hadiah', 'Tools']);
});
