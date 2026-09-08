/**
 * Test-only stand-in for `next/headers`.
 *
 * The real module only exists inside the Next request runtime, so importing a
 * route handler under `node --test` fails at resolution — before any assertion
 * about the handler's own logic can run. The stub returns an empty cookie/header
 * store, which is exactly the situation a route's unauthenticated path is
 * supposed to handle: no session, no headers, deny.
 *
 * It deliberately cannot fabricate a session. A test that needs one must mint a
 * real token through the auth module rather than pretend here.
 */
const emptyStore = {
  get: () => undefined,
  getAll: () => [],
  has: () => false,
  set: () => { throw new Error("next/headers stub is read-only: routes under test must not mutate cookies."); },
  delete: () => { throw new Error("next/headers stub is read-only: routes under test must not mutate cookies."); },
  entries: () => [][Symbol.iterator](),
  [Symbol.iterator]: () => [][Symbol.iterator](),
};

export async function cookies() { return emptyStore; }
export async function headers() { return new Headers(); }
export async function draftMode() { return { isEnabled: false }; }
