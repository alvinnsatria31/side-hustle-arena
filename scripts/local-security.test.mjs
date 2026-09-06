import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalSandboxRequest, isLocalSandboxEnvironment } from '../src/server/dev/guard.ts';

const env = { APP_ENV: 'development', NODE_ENV: 'development', ARENA_LOCAL_SANDBOX: '1', DATABASE_URL: 'postgres://arena:fixture@127.0.0.1:55432/arena_local', SESSION_SECRET: 'a'.repeat(64), ARENA_ORIGIN: 'http://localhost:3001' };
function request(url = env.ARENA_ORIGIN, origin = env.ARENA_ORIGIN, extra = {}) {
  return new Request(`${url}/api/dev/session`, { method: 'POST', headers: { host: new URL(url).host, origin, ...extra } });
}

test('sandbox permits explicit loopback development and same-origin POST', () => {
  assert.equal(isLocalSandboxRequest(request(), env), true);
  assert.equal(isLocalSandboxEnvironment({ ...env, APP_ENV: 'test' }), true);
});

test('sandbox rejects production, deployment, missing flag, cloud DB and weak secrets', () => {
  for (const override of [ { APP_ENV: 'production' }, { NODE_ENV: 'production' }, { VERCEL: '1' }, { VERCEL_ENV: 'preview' }, { ARENA_LOCAL_SANDBOX: '' }, { DATABASE_URL: 'postgres://arena:fixture@db.example.com/arena_local' }, { DATABASE_URL: 'postgres://arena:fixture@localhost/production' }, { SESSION_SECRET: 'short' }, { ARENA_ORIGIN: 'https://arena.sekolahkarir.id' } ]) {
    assert.equal(isLocalSandboxEnvironment({ ...env, ...override }), false, JSON.stringify(override));
  }
});

test('sandbox rejects foreign hosts, cross-origin, missing origin and proxies', () => {
  for (const req of [ request('http://evil.example'), request(undefined, 'http://evil.example'), request(undefined, 'null'), request(undefined, undefined, { host: 'evil.example' }), request(undefined, undefined, { 'x-forwarded-host': 'evil.example' }), request(undefined, undefined, { 'x-forwarded-for': '8.8.8.8' }), new Request(`${env.ARENA_ORIGIN}/api/dev/session`, { method: 'POST', headers: { host: 'localhost:3001' } }) ]) {
    assert.equal(isLocalSandboxRequest(req, env), false);
  }
});
