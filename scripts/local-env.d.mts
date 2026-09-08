/**
 * Types for the sandbox environment helper.
 *
 * `local-env.mjs` is plain JavaScript because `scripts/local-dev.mjs` runs it
 * with bare Node before anything is compiled. TypeScript callers (the sandbox
 * Playwright config and its setup hooks) still need to know its shape, so it is
 * declared here rather than by loosening `noImplicitAny` for everyone.
 */
export declare const localEnvFile: string;
export declare function localEnvironment(options?: { create?: boolean }): Record<string, string> & {
  ARENA_ORIGIN: string;
  DATABASE_URL: string;
  SESSION_SECRET: string;
};
