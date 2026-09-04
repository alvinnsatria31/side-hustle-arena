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

/**
 * Expands an IPv6 literal (no zone ID) into eight 16-bit groups.
 * Returns null when the literal is malformed. Hex-only `::ffff:` forms are
 * handled too — only dotted-decimal tails take the IPv4 shortcut.
 */
function expandIpv6(address: string): number[] | null {
  let head = address.toLowerCase();
  let tail: number[] = [];
  const v4match = head.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4match) {
    const octets = v4match[1].split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    tail = [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]];
    // Drop the dotted tail plus its separator colon ("::ffff:1.2.3.4" → "::ffff").
    head = head.slice(0, head.length - v4match[1].length).replace(/:$/, "");
  }
  const halves = head.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const group = /^[0-9a-f]{1,4}$/;
  if ([...left, ...right].some((g) => !group.test(g))) return null;
  const missing = 8 - tail.length - left.length - right.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;
  const groups = [
    ...left.map((g) => parseInt(g, 16)),
    ...new Array(Math.max(0, missing)).fill(0),
    ...right.map((g) => parseInt(g, 16)),
    ...tail,
  ];
  return groups.length === 8 ? groups : null;
}

function embeddedIpv4(g6: number, g7: number): string {
  return `${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`;
}

function isBlockedIpv6(address: string): boolean {
  // Zone IDs never occur in vetted DNS answers; reject explicitly.
  if (address.includes("%")) return true;
  const g = expandIpv6(address);
  if (!g) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g;
  if (g.every((v) => v === 0)) return true; // ::
  if (g.slice(0, 7).every((v) => v === 0) && g7 === 1) return true; // ::1
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if (g0 === 0x2001 && g1 === 0x0db8) return true; // 2001:db8::/32 documentation
  if (g0 === 0x0100 && g1 === 0 && g2 === 0 && g3 === 0) return true; // 100::/64 discard
  if (g0 === 0x2001 && (g1 & 0xfff0) === 0x0010) return true; // 2001:10::/28 ORCHID
  // IPv4-mapped ::ffff:0:0/96 (dotted or hex form) → vet the embedded IPv4.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isBlockedIpv4(embeddedIpv4(g6, g7));
  }
  // 6to4 2002::/16 embeds a full IPv4 address in g1:g2.
  if (g0 === 0x2002) return isBlockedIpv4(embeddedIpv4(g1, g2));
  // Teredo 2001::/32 embeds the client IPv4 obfuscated (xor 0xffffffff).
  if (g0 === 0x2001 && g1 === 0x0000) {
    return isBlockedIpv4(embeddedIpv4((~g6) & 0xffff, (~g7) & 0xffff));
  }
  // NAT64 64:ff9b::/96 embeds the IPv4 address in g6:g7.
  if (g0 === 0x0064 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIpv4(embeddedIpv4(g6, g7));
  }
  // ISATAP ::0:5efe:x embeds the IPv4 address in g6:g7.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0x5efe) {
    return isBlockedIpv4(embeddedIpv4(g6, g7));
  }
  return false;
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
