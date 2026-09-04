import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";

type Resolver = (hostname: string) => Promise<string[]>;

type HttpProbe = (input: { url: URL; addresses: string[] }) => Promise<{ statusCode: number; location: string | undefined }>;

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 5_000;

function isBlockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168 || b === 2))
    || (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0);
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("ff") || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("2001:db8")) return true;
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return Boolean(mappedIpv4 && isBlockedIpv4(mappedIpv4));
}

function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  return version === 4 ? isBlockedIpv4(address) : version === 6 ? isBlockedIpv6(address) : true;
}

export async function assertSafeExternalUrl(value: string, { resolve }: { resolve: Resolver }) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Blocked external URL.");
  const addresses = await resolve(url.hostname);
  if (!addresses.length || addresses.some(isBlockedAddress)) throw new Error("Blocked external URL target.");
  return { url, addresses };
}

async function resolvePublicAddresses(hostname: string): Promise<string[]> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map((entry) => entry.address);
}

/**
 * Probe order: IPv4 first, then IPv6, duplicates removed. Every address was
 * already vetted by assertSafeExternalUrl, so trying the next one on a
 * connection error is safe — and necessary, because some networks resolve
 * AAAA first while their IPv6 egress is broken. Pure (unit-testable).
 */
export function orderAddressesForProbe(addresses: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const address of [...addresses].sort((a, b) => isIP(a) - isIP(b))) {
    if (!seen.has(address)) {
      seen.add(address);
      ordered.push(address);
    }
  }
  return ordered;
}

function probeOnce(url: URL, address: string): Promise<{ statusCode: number; location: string | undefined }> {
  return new Promise((resolve, reject) => {
    const family = isIP(address);
    const request = httpsRequest({
      protocol: "https:",
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "HEAD",
      headers: { "User-Agent": "ArenaSubmissionAccessCheck/1.0" },
      // Pin the vetted address with an explicit family: Node rejects IPv6
      // answers from a custom lookup when family is unset.
      family,
      lookup: (_hostname, _options, callback) => callback(null, address, family),
    }, (response) => {
      response.destroy();
      resolve({
        statusCode: response.statusCode ?? 0,
        location: typeof response.headers.location === "string" ? response.headers.location : undefined,
      });
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("External URL check timed out.")));
    request.once("error", reject);
    request.end();
  });
}

const probeHttps: HttpProbe = async ({ url, addresses }) => {
  const ordered = orderAddressesForProbe(addresses);
  let lastError: unknown = new Error("No probe addresses.");
  for (const address of ordered) {
    try {
      return await probeOnce(url, address);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

/**
 * Verifies an external HTTPS destination without forwarding caller headers,
 * cookies, or credentials. DNS is resolved and pinned for every hop so a
 * redirect or rebinding attempt cannot reach a private address.
 */
export async function checkExternalUrlAccess(value: string, options: { resolve?: Resolver; probe?: HttpProbe } = {}) {
  const resolve = options.resolve ?? resolvePublicAddresses;
  const probe = options.probe ?? probeHttps;
  let current = value;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const { url, addresses } = await assertSafeExternalUrl(current, { resolve });
    const result = await probe({ url, addresses });
    if (result.statusCode >= 200 && result.statusCode < 300) return { accessible: true, finalUrl: url.toString() };
    if (result.statusCode < 300 || result.statusCode >= 400 || !result.location || redirectCount === MAX_REDIRECTS) {
      return { accessible: false, finalUrl: url.toString() };
    }
    current = new URL(result.location, url).toString();
  }

  return { accessible: false, finalUrl: current };
}
