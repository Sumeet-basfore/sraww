import { lookup as dnsLookup } from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';
import { LEARN_LIMITS } from '../../shared/learn.ts';

export const SOURCE_CHECK = { timeoutMs: 8_000, maxRedirects: 3 } as const;

/** What the check needs from one answer: the status, any redirect target, and the content type. */
export interface SourceAnswer {
  status: number;
  location: string | null;
  contentType: string | null;
}

export interface SourceCheckDeps {
  /** Resolves a host name to its addresses. */
  lookup: (hostname: string) => Promise<string[]>;
  /**
   * One GET to `url`, connected only to `address`. Pinning the connection to the address that was
   * checked means a name cannot resolve to a different address between the check and the request.
   */
  request: (url: URL, address: string, timeoutMs: number) => Promise<SourceAnswer>;
}

function firstHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Sends the GET and reads only the answer's headers; the body is discarded without being read. */
function requestPinned(url: URL, address: string, timeoutMs: number): Promise<SourceAnswer> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: { accept: 'text/html,text/plain;q=0.9' },
        signal: AbortSignal.timeout(timeoutMs),
        lookup: (_hostname, options, callback) => {
          const family = net.isIP(address);
          if (options.all) callback(null, [{ address, family }]);
          else callback(null, address, family);
        },
      },
      (res) => {
        resolve({
          status: res.statusCode ?? 0,
          location: firstHeader(res.headers.location),
          contentType: firstHeader(res.headers['content-type']),
        });
        res.destroy();
      },
    );
    req.on('error', reject);
    req.end();
  });
}

export const defaultSourceCheckDeps: SourceCheckDeps = {
  lookup: async (hostname) => (await dnsLookup(hostname, { all: true })).map((r) => r.address),
  request: requestPinned,
};

/** Accepts only https URLs without credentials, within the length limit. */
export function parseSourceUrl(raw: string): URL | null {
  if (raw.length > LEARN_LIMITS.maxUrl) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

/** IPv4 ranges that are not public: this network, private, shared, loopback, link-local, test,
 * benchmarking, documentation, multicast and reserved. */
const NON_PUBLIC_IPV4 = [
  /^0\./,
  /^10\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^192\.168\./,
  /^192\.88\.99\./,
  /^198\.(1[89])\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^(22[4-9]|23\d|24\d|25[0-5])\./,
];

function isPublicIPv6(lower: string): boolean {
  // The first 16-bit group decides the block for each prefix checked below.
  const first = Number.parseInt(lower.split(':')[0] || '0', 16);
  if (first === 0) return false; // ::/8: unspecified, loopback and IPv4-compatible forms
  if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((first & 0xffc0) === 0xfec0) return false; // site-local fec0::/10 (deprecated)
  if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((first & 0xff00) === 0xff00) return false; // multicast ff00::/8
  // Compare the numeric groups, so every spelling of 2001:db8::/32 is caught (for example 2001:0db8::1).
  const second = Number.parseInt(lower.split(':')[1] || '0', 16);
  if (first === 0x2001 && second === 0x0db8) return false; // documentation 2001:db8::/32
  return true;
}

/**
 * True only for addresses on the public internet. Loopback, private, link-local, shared, reserved
 * and documentation ranges are refused, so that a steered model cannot make the server fetch the
 * user's own network or any other non-public address.
 */
export function isPublicAddress(address: string): boolean {
  const lower = address.toLowerCase();
  const family = net.isIP(lower);
  if (family === 4) return !NON_PUBLIC_IPV4.some((range) => range.test(lower));
  if (family === 6) {
    if (lower.startsWith('::ffff:')) return isPublicAddress(lower.slice('::ffff:'.length));
    return isPublicIPv6(lower);
  }
  return false;
}

/**
 * Checks that a cited source exists: https, a public host, a 200 answer with a text type. Every
 * address the host resolves to must be public, and the request is made to one of those addresses.
 * Redirects are followed only as far as the same checks allow.
 */
export async function checkSourceUrl(
  raw: string,
  deps: SourceCheckDeps = defaultSourceCheckDeps,
): Promise<boolean> {
  let current = parseSourceUrl(raw);
  for (let hop = 0; hop <= SOURCE_CHECK.maxRedirects; hop += 1) {
    if (!current) return false;
    const addresses = await deps.lookup(current.hostname).catch(() => []);
    if (addresses.length === 0 || !addresses.every(isPublicAddress)) return false;
    const answer = await deps
      .request(current, addresses[0] as string, SOURCE_CHECK.timeoutMs)
      .catch(() => null);
    if (!answer) return false;

    if (answer.status >= 300 && answer.status < 400) {
      if (!answer.location) return false;
      current = parseLocation(answer.location, current);
      continue;
    }
    return answer.status === 200 && /^text\/(html|plain)\b/i.test(answer.contentType ?? '');
  }
  return false;
}

function parseLocation(location: string, base: URL): URL | null {
  try {
    return parseSourceUrl(new URL(location, base).href);
  } catch {
    return null;
  }
}
