// The local CV copy on a shared browser (audit W1). Pure state functions only:
// synthetic CV, in-memory storage, no browser and no account.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CV_RESULT_TTL_MS, STATE_VERSION, STORAGE_KEY,
  clearLocalAccountData, demoReducer, initialDemoState, readStoredState,
} from '../src/features/demo/state.ts';

function memoryStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

const result = { fileName: 'SYNTHETIC-CV-A.pdf', score: 42, analyzedAt: '2026-09-11T00:00:00.000Z' };

function scannedBy(ownerId) {
  let state = demoReducer(initialDemoState(), { type: 'LOGIN' });
  state = demoReducer(state, { type: 'CV_SET_FILE', fileName: result.fileName, fileSize: 1000, ownerId });
  state = demoReducer(state, { type: 'CV_START', ownerId });
  return demoReducer(state, { type: 'CV_COMPLETE', result });
}

test('LOGOUT clears the local CV analysis together with the identity', () => {
  const before = scannedBy('participant-a');
  assert.equal(before.cvScan.result.fileName, result.fileName);
  const after = demoReducer(before, { type: 'LOGOUT' });
  assert.equal(after.user, null);
  assert.equal(after.cvScan.status, 'idle');
  assert.equal(after.cvScan.result, null);
  assert.equal(after.cvScan.fileName, null);
  assert.equal(after.cvScan.ownerId, null);
});

test('a scan records the account it was made under', () => {
  assert.equal(scannedBy('participant-a').cvScan.ownerId, 'participant-a');
  assert.equal(scannedBy(null).cvScan.ownerId, null);
});

test('another account, or a guest, opening the browser drops the previous analysis', () => {
  const stored = scannedBy('participant-a');
  for (const next of ['participant-b', null]) {
    const seen = demoReducer(stored, { type: 'CV_ENFORCE_OWNER', ownerId: next });
    assert.equal(seen.cvScan.result, null, `owner ${next} must not see participant-a's CV`);
    assert.equal(seen.cvScan.status, 'idle');
  }
});

test('the owner keeps their own analysis', () => {
  const stored = scannedBy('participant-a');
  assert.equal(demoReducer(stored, { type: 'CV_ENFORCE_OWNER', ownerId: 'participant-a' }), stored);
});

test('scan A, log out, then B opens the result page from the same storage: nothing of A loads', () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(scannedBy('participant-a')));
  clearLocalAccountData(storage);
  assert.equal(storage.getItem(STORAGE_KEY), null, 'logout removes the stored copy before leaving the page');

  // Even if the copy survived (logout from another tab or the main site), B's guard drops it.
  storage.setItem(STORAGE_KEY, JSON.stringify(scannedBy('participant-a')));
  const loaded = readStoredState(storage);
  assert.equal(demoReducer(loaded, { type: 'CV_ENFORCE_OWNER', ownerId: 'participant-b' }).cvScan.result, null);
});

test('a copy saved before ownership was recorded is erased on load, not just hidden', () => {
  const legacy = scannedBy('participant-a');
  delete legacy.cvScan.ownerId;
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(legacy) });
  const loaded = readStoredState(storage);
  assert.equal(loaded.cvScan.result, null);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).cvScan.result, null, 'the CV no longer sits in storage');
  assert.deepEqual(loaded.completedHistory, legacy.completedHistory, 'unrelated demo state survives');
});

test('an analysis past its lifetime is erased on load', () => {
  const now = Date.parse('2026-09-12T12:00:00.000Z');
  const stale = scannedBy('participant-a');
  stale.cvScan.completedAt = new Date(now - CV_RESULT_TTL_MS - 1).toISOString();
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(stale) });
  assert.equal(readStoredState(storage, now).cvScan.result, null);

  const fresh = scannedBy('participant-a');
  fresh.cvScan.completedAt = new Date(now - 60_000).toISOString();
  assert.equal(readStoredState(memoryStorage({ [STORAGE_KEY]: JSON.stringify(fresh) }), now).cvScan.result.fileName, result.fileName);
});

test('an unreadable or foreign-version blob is removed from storage', () => {
  for (const raw of ['{not json', JSON.stringify({ version: STATE_VERSION + 1, cvScan: scannedBy('x').cvScan })]) {
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    assert.equal(readStoredState(storage), null);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  }
});
