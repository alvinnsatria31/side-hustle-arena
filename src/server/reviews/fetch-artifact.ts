import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { assertSafeExternalUrl, orderAddressesForProbe } from '@/server/submissions/url-access';

const MAX_BYTES = 20 * 1024 * 1024;

const DEFAULT_HOP_TIMEOUT_MS = 15_000;

function fetchAddress(url: URL, address: string, signal?: AbortSignal, timeoutMs = DEFAULT_HOP_TIMEOUT_MS): Promise<{ bytes: Buffer; mime: string; status: number; location?: string }> {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: url.hostname, port: url.port || undefined, path: `${url.pathname}${url.search}`,
      method: 'GET', family: isIP(address),
      lookup: (_host, _options, callback) => callback(null, address, isIP(address)),
      headers: { 'User-Agent': 'ArenaArtifactReader/1.0', 'Accept-Encoding': 'identity' },
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400) {
        resolve({ bytes: Buffer.alloc(0), mime: '', status: res.statusCode!, location: res.headers.location });
        res.destroy(); return;
      }
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { res.destroy(new Error('Artifact exceeds 20 MB.')); return; }
        chunks.push(chunk);
      });
      res.once('error', reject);
      res.once('end', () => resolve({ bytes: Buffer.concat(chunks), mime: (res.headers['content-type'] ?? '').split(';')[0], status: res.statusCode ?? 0 }));
    });
    // The caller's remaining budget bounds this hop as well as the hop's own
    // ceiling: four redirects at 15s each must not outlive the invocation.
    const timer = setTimeout(() => req.destroy(new Error('Artifact fetch timed out.')), Math.max(1, timeoutMs));
    const abort = () => req.destroy(new Error('Artifact fetch ran out of execution budget.'));
    signal?.addEventListener('abort', abort, { once: true });
    req.once('close', () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); });
    req.once('error', reject);
    req.end();
  });
}

export async function fetchPublicArtifact(value: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}) {
  let current = value;
  for (let hop = 0; hop <= 3; hop += 1) {
    options.signal?.throwIfAborted();
    const { url, addresses } = await assertSafeExternalUrl(current, {
      resolve: async (hostname) => (await lookup(hostname, { all: true })).map((entry) => entry.address),
    });
    let response: Awaited<ReturnType<typeof fetchAddress>> | undefined;
    for (const address of orderAddressesForProbe(addresses)) {
      try { response = await fetchAddress(url, address, options.signal, options.timeoutMs); break; } catch { /* Try the next vetted address. */ }
    }
    if (!response) throw new Error('Artifact could not be downloaded.');
    if (response.status >= 200 && response.status < 300) return { ...response, url: current };
    if (response.status >= 300 && response.status < 400 && response.location && hop < 3) {
      current = new URL(response.location, url).toString(); continue;
    }
    throw new Error('Artifact is not publicly readable.');
  }
  throw new Error('Too many artifact redirects.');
}
