// Pure guard shared by the fixture routes and offline security tests.
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalSandboxEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!['development', 'test'].includes(env.APP_ENV ?? '') || !['development', 'test'].includes(env.NODE_ENV ?? '') || env.ARENA_LOCAL_SANDBOX !== '1' || env.VERCEL || env.VERCEL_ENV || (env.SESSION_SECRET?.length ?? 0) < 32) return false;
  try {
    const db = new URL(env.DATABASE_URL ?? '');
    const origin = new URL(env.ARENA_ORIGIN ?? '');
    return ['postgres:', 'postgresql:'].includes(db.protocol) && loopbackHosts.has(db.hostname) && db.pathname === '/arena_local' && !db.search &&
      origin.protocol === 'http:' && loopbackHosts.has(origin.hostname) && origin.origin === env.ARENA_ORIGIN;
  } catch { return false; }
}

export function isLocalSandboxRequest(request: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isLocalSandboxEnvironment(env)) return false;
  const url = new URL(request.url);
  const host = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (url.origin !== env.ARENA_ORIGIN || host !== url.host || (forwardedHost && forwardedHost !== host)) return false;
  // Next sets forwarding headers for direct connections too; accept only a
  // single loopback peer, never a proxy chain or a remote client.
  if (forwardedFor && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(forwardedFor)) return false;
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('origin') !== url.origin) return false;
  return true;
}
