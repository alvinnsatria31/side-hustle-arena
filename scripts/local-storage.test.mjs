import test from 'node:test';
import assert from 'node:assert/strict';
import { useLocalStoragePathStyle } from '../src/server/storage/storage-client.ts';

test('only development loopback S3 emulators use path-style addressing', () => {
  assert.equal(useLocalStoragePathStyle('http://127.0.0.1:59000', 'development'), true);
  assert.equal(useLocalStoragePathStyle('http://localhost:59000', 'development'), true);
  assert.equal(useLocalStoragePathStyle('http://127.0.0.1:59000', 'production'), false);
  assert.equal(useLocalStoragePathStyle('https://cos.ap-jakarta.myqcloud.com', 'development'), false);
  assert.equal(useLocalStoragePathStyle('https://cos.ap-jakarta.myqcloud.com', 'production'), false);
});
