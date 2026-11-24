import { describe, expect, it, vi } from 'vitest';
import {
  checkSourceUrl,
  isPublicAddress,
  parseSourceUrl,
  type SourceCheckDeps,
} from '../../src/server/learn/sources.ts';

const PUBLIC_IP = '93.184.216.34';

/** Builds deps whose host always resolves to a public address unless the test says otherwise. */
function deps(
  respond: (url: string) => Response | Promise<Response>,
  addresses: string[] = [PUBLIC_IP],
): SourceCheckDeps & { fetch: ReturnType<typeof vi.fn> } {
  return {
    fetch: vi.fn(async (url: string) => respond(url)),
    lookup: async () => addresses,
  } as SourceCheckDeps & { fetch: ReturnType<typeof vi.fn> };
}

const page = (status: number, type = 'text/html; charset=utf-8', headers: HeadersInit = {}) =>
  new Response(null, { status, headers: { 'content-type': type, ...(headers as object) } });

describe('parseSourceUrl', () => {
  it('accepts an https address', () => {
    expect(parseSourceUrl('https://developer.mozilla.org/en-US/docs/Web/HTTP')?.hostname).toBe(
      'developer.mozilla.org',
    );
  });

  it('rejects plain http, credentials, bad text and overlong addresses', () => {
    expect(parseSourceUrl('http://example.com/a')).toBeNull();
    expect(parseSourceUrl('https://user:pass@example.com/a')).toBeNull();
    expect(parseSourceUrl('not a url')).toBeNull();
    expect(parseSourceUrl(`https://example.com/${'a'.repeat(200)}`)).toBeNull();
  });
});

describe('isPublicAddress', () => {
  it('accepts public IPv4 and IPv6 addresses', () => {
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('refuses loopback, private, link-local and mapped private addresses', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.5',
      '172.20.0.1',
      '169.254.1.1',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      '::',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it('refuses anything that is not an IP address', () => {
    expect(isPublicAddress('localhost')).toBe(false);
  });
});

describe('checkSourceUrl', () => {
  it('accepts a page that answers 200 with HTML', async () => {
    const d = deps(() => page(200));
    expect(await checkSourceUrl('https://example.com/docs', d)).toBe(true);
  });

  it('accepts a plain-text page', async () => {
    const d = deps(() => page(200, 'text/plain'));
    expect(await checkSourceUrl('https://example.com/a.txt', d)).toBe(true);
  });

  it('refuses a missing page', async () => {
    const d = deps(() => page(404));
    expect(await checkSourceUrl('https://example.com/missing', d)).toBe(false);
  });

  it('refuses a binary or unknown content type', async () => {
    const d = deps(() => page(200, 'application/octet-stream'));
    expect(await checkSourceUrl('https://example.com/file', d)).toBe(false);
  });

  it('never fetches a host that resolves to a private address', async () => {
    const d = deps(() => page(200), ['192.168.1.10']);
    expect(await checkSourceUrl('https://intranet.example/doc', d)).toBe(false);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('follows a redirect to another https page and checks that page too', async () => {
    const d = deps((url) =>
      url.endsWith('/old') ? page(301, 'text/html', { location: '/new' }) : page(200),
    );
    expect(await checkSourceUrl('https://example.com/old', d)).toBe(true);
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it('refuses a redirect that leaves https', async () => {
    const d = deps(() => page(302, 'text/html', { location: 'http://example.com/plain' }));
    expect(await checkSourceUrl('https://example.com/start', d)).toBe(false);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after too many redirects', async () => {
    const d = deps(() => page(302, 'text/html', { location: '/again' }));
    expect(await checkSourceUrl('https://example.com/loop', d)).toBe(false);
  });

  it('refuses when the request fails or times out', async () => {
    const d = deps(() => {
      throw new Error('network down');
    });
    expect(await checkSourceUrl('https://example.com/down', d)).toBe(false);
  });

  it('refuses when the host name does not resolve', async () => {
    const d: SourceCheckDeps = {
      fetch: vi.fn(async () => page(200)),
      lookup: async () => {
        throw new Error('ENOTFOUND');
      },
    };
    expect(await checkSourceUrl('https://nowhere.invalid/', d)).toBe(false);
  });

  it('refuses an address that is not https before any request', async () => {
    const d = deps(() => page(200));
    expect(await checkSourceUrl('http://example.com/a', d)).toBe(false);
    expect(d.fetch).not.toHaveBeenCalled();
  });
});
