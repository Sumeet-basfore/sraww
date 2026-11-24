import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';
import { LEARN_LIMITS } from '../../shared/learn.ts';

export const SOURCE_CHECK = { timeoutMs: 8_000, maxRedirects: 3 } as const;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export type HostLookup = (hostname: string) => Promise<string[]>;

export interface SourceCheckDeps {
  fetch: FetchLike;
  lookup: HostLookup;
}

export const defaultSourceCheckDeps: SourceCheckDeps = {
  fetch: (url, init) => fetch(url, init),
  lookup: async (hostname) => (await dnsLookup(hostname, { all: true })).map((r) => r.address),
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

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

/**
 * True only for addresses on the public internet. Loopback, private and link-local ranges are
 * refused so that a steered model cannot make the server fetch the user's own network.
 */
export function isPublicAddress(address: string): boolean {
  const lower = address.toLowerCase();
  const family = net.isIP(lower);
  if (family === 4) return !PRIVATE_IPV4.some((range) => range.test(lower));
  if (family === 6) {
    if (lower.startsWith('::ffff:')) return isPublicAddress(lower.slice('::ffff:'.length));
    return !(
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    );
  }
  return false;
}

async function hostIsPublic(hostname: string, deps: SourceCheckDeps): Promise<boolean> {
  const addresses = await deps.lookup(hostname).catch(() => []);
  return addresses.length > 0 && addresses.every(isPublicAddress);
}

/**
 * Checks that a cited source exists: https, a public host, a 200 answer with a text type. Redirects
 * are followed only as far as the same checks allow. The body is not read, so a check is cheap.
 */
export async function checkSourceUrl(
  raw: string,
  deps: SourceCheckDeps = defaultSourceCheckDeps,
): Promise<boolean> {
  let current = parseSourceUrl(raw);
  for (let hop = 0; hop <= SOURCE_CHECK.maxRedirects; hop += 1) {
    if (!current || !(await hostIsPublic(current.hostname, deps))) return false;
    const response = await deps
      .fetch(current.href, {
        redirect: 'manual',
        signal: AbortSignal.timeout(SOURCE_CHECK.timeoutMs),
        headers: { accept: 'text/html,text/plain;q=0.9' },
      })
      .catch(() => null);
    if (!response) return false;
    await response.body?.cancel().catch(() => undefined);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return false;
      current = parseLocation(location, current);
      continue;
    }
    if (response.status !== 200) return false;
    return /^text\/(html|plain)\b/i.test(response.headers.get('content-type') ?? '');
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
