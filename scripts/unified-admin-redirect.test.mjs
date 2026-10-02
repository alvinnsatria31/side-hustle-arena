import test from 'node:test';
import assert from 'node:assert/strict';
import config from '../next.config.mjs';

test('legacy admin UI redirects to central panel while APIs stay untouched', async()=>{
  const rules = await config.redirects();
  assert.deepEqual(rules.map(r=>r.source), ['/app/admin/:path*','/admin/:path*']);
  assert.ok(rules.every(r=>r.destination==='https://www.sekolahkarir.id/admin/integrations/arena'&&r.permanent===false));
  assert.ok(rules.every(r=>!r.source.includes('/api')));
});
test('central admin origin supports isolated loopback and refuses unsafe config', async()=>{
  const previous = {origin:process.env.SK_AUTH_ORIGIN,app:process.env.APP_ENV};
  try {
    process.env.APP_ENV='test';process.env.SK_AUTH_ORIGIN='http://localhost:3100';
    assert.equal((await config.redirects())[0].destination,'http://localhost:3100/admin/integrations/arena');
    for(const origin of ['https://name:password@www.sekolahkarir.id','https://www.sekolahkarir.id/other','https://www.sekolahkarir.id?next=evil','http://evil.invalid','https://arena.sekolahkarir.id']) {
      process.env.SK_AUTH_ORIGIN=origin;await assert.rejects(()=>config.redirects());
    }
  } finally {
    if(previous.origin===undefined) delete process.env.SK_AUTH_ORIGIN;else process.env.SK_AUTH_ORIGIN=previous.origin;
    if(previous.app===undefined) delete process.env.APP_ENV;else process.env.APP_ENV=previous.app;
  }
});
