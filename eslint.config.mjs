// Flat config for Next 16.3.3 + ESLint 9.18 (see
// node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md).
// `eslint/config` (defineConfig/globalIgnores) only exists from ESLint 9.23, so
// the config stays a plain array. `core-web-vitals` brings the Next/React/hooks
// rules; `typescript` layers typescript-eslint on top so .ts/.tsx actually get
// linted — before this, the config was ignores-only and `npm run lint` passed
// without reading a single application file.
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      // eslint-config-next's own defaults, restated because listing `ignores`
      // here replaces rather than extends them.
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      // This repo's generated and vendored trees.
      'node_modules/**',
      'dist/**',
      'drizzle/**',
      'graphify-out/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      '.superpowers/**',
    ],
  },
  ...nextVitals,
  ...nextTypeScript,
  {
    // A leading underscore is this repo's existing "deliberately unused"
    // marker (route handlers that ignore `_request`, destructured rows).
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // Node test scripts and Playwright specs are not React or Next code. The
    // hooks rules read Playwright's `use` fixture as a hook, and the Next rule
    // reads a `module` local in a CommonJS-style test as the bundler global.
    files: ['scripts/**', 'e2e/**', '*.config.mjs', '*.config.ts'],
    rules: {
      '@next/next/no-assign-module-variable': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    // `src/server/**` is `import "server-only"` Node code — no React reaches it.
    // The hooks rule matches on NAME alone, so a plain server helper called
    // `useLocalStoragePathStyle` is reported as a hook used outside a component.
    // Same reasoning as the scripts/e2e block above: scope the React rules to
    // React code rather than rename server functions to appease a matcher.
    files: ['src/server/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    // `set-state-in-effect` ships enabled in the React Compiler-era hooks
    // plugin and flags eight pre-existing sites here (hydration gates, external
    // store syncs, route-change resets). They are real and worth fixing, but
    // each needs a considered React change, not a lint-driven one — so it stays
    // visible as a warning instead of blocking the gate on day one. Tracked in
    // docs/backend/END_TO_END_IMPLEMENTATION.md.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];

export default config;
