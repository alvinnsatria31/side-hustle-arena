// Superseded: audit W1 is fixed, and its reducer moved from store.tsx (which
// this script used to extract by AST) to src/features/demo/state.ts. The
// regression assertions live in scripts/demo-cv-isolation.test.mjs, which
// `npm run test:offline` also runs; this keeps the report's command working.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(process.execPath, ['--import', './scripts/node-test-hooks.mjs', '--test', 'scripts/demo-cv-isolation.test.mjs'], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
