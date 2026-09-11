// Saved projects for later (audit: bookmarks had no list). Pure storage helpers.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SAVED_PROJECTS_KEY, pruneSavedProjects, readSavedProjects, toggleSavedProject } from '../src/lib/saved-projects.ts';

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { getItem: (key) => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)); } };
}

test('saving and unsaving keeps the order projects were saved in', () => {
  const storage = memoryStorage();
  assert.deepEqual(toggleSavedProject('a', storage), { saved: true, list: ['a'] });
  assert.deepEqual(toggleSavedProject('b', storage), { saved: true, list: ['a', 'b'] });
  assert.deepEqual(toggleSavedProject('a', storage), { saved: false, list: ['b'] });
  assert.deepEqual(readSavedProjects(storage), ['b']);
});

test('the list the catalog reads is the one the save button writes', () => {
  // ProjectDetail used to write this key with nothing reading it back.
  const storage = memoryStorage({ [SAVED_PROJECTS_KEY]: JSON.stringify(['from-detail-page']) });
  assert.deepEqual(readSavedProjects(storage), ['from-detail-page']);
});

test('malformed storage is ignored instead of trusted', () => {
  for (const raw of ['{bad', '"a string"', JSON.stringify([1, null, '', 'ok', 'ok', 'x'.repeat(201)])]) {
    const list = readSavedProjects(memoryStorage({ [SAVED_PROJECTS_KEY]: raw }));
    assert.ok(list.every((slug) => typeof slug === 'string' && slug.length > 0 && slug.length <= 200), raw);
  }
  assert.deepEqual(readSavedProjects(memoryStorage({ [SAVED_PROJECTS_KEY]: JSON.stringify(['ok', 'ok']) })), ['ok']);
});

test('pruning drops projects no longer in the catalog', () => {
  const storage = memoryStorage({ [SAVED_PROJECTS_KEY]: JSON.stringify(['old-week', 'this-week']) });
  assert.deepEqual(pruneSavedProjects(['this-week', 'other'], storage), ['this-week']);
  assert.deepEqual(readSavedProjects(storage), ['this-week']);
});

test('without storage nothing claims to be saved', () => {
  assert.equal(toggleSavedProject('a', null), null);
  assert.deepEqual(readSavedProjects(null), []);
});
