// Test-only ESM hooks for plain `node --test` (no bundler, no tsx).
//
// Resolves three things the Next.js toolchain normally handles:
// 1. `@` path alias to `./src`
// 2. Extensionless relative imports to TS files or index files
//    (type stripping handles the rest on Node 24+)
// 3. `server-only` to an empty stub (its real package throws on import
//    outside React Server Components; stubbing is honest here because these
//    scripts ARE server-side Node, just without the Next compiler)
//
// Used only by the `test:e2e:*` npm scripts via `--import`. Existing suites
// keep running on bare `node --test` untouched.
import { register } from "node:module";

register(new URL("./node-test-resolve-hooks.mjs", import.meta.url));
