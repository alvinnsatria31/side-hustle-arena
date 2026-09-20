import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('local Arena browser sandbox uses a separate Next output directory', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "import config from './next.config.mjs'; process.stdout.write(config.distDir ?? '.next')"], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ARENA_LOCAL_SANDBOX: '1' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '.next-arena-local');
});
