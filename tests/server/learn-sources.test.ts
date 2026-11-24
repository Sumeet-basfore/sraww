import { describe, expect, it, vi } from 'vitest';
import {
  checkSourceUrl,
  isPublicAddress,
  parseSourceUrl,
  type SourceAnswer,
  type SourceCheckDeps,
} from '../../src/server/learn/sources.ts';

const PUBLIC_IP = '93.184.216.34';

/** Deps whose host resolves to `addresses` and whose requests get `answer(url)`. */
function deps(
  answer: (url: URL) => SourceAnswer | Promise<SourceAnswer>,
  addresses: string[] = [PUBLIC_IP],
) {
  const request = vi.fn(async (url: URL) => answer(url));
  const d: SourceCheckDeps & { request: typeof request } = {
    request,
    lookup: async () => addresses,
  };
  return d;
}

const page = (
  status: number,
  contentType = 'text/html; charset=utf-8',
  location: string | null = null,
): SourceAnswer => ({
  status,
  location,
  contentType,
});

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
    expect(isPublicAddress('93.184.216.34')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
  });

  it('refuses non-public IPv4 ranges', () => {
    for (const address of [
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '172.20.0.1',
      '192.0.0.8',
      '192.0.2.1',
      '192.168.0.5',
      '198.18.0.1',
      '198.19.255.1',
      '198.51.100.7',
      '203.0.113.9',
      '224.0.0.1',
      '240.0.0.1',
      '255.255.255.255',
    ]) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it('refuses every IPv6 link-local address, not only fe80::', () => {
    for (const address of ['fe80::1', 'fe90::1', 'fea0::1', 'febf::1', 'FEBF::1']) {
      expect(isPublicAddress(address), address).toBe(false);
    }
  });

  it('refuses site-local, unique-local, multicast, unspecified, loopback and documentation IPv6', () => {
    for (const address of [
      'fec0::1',
      'fc00::1',
      'fd12:3456::1',
      'ff02::1',
      '::',
      '::1',
      '::127.0.0.1',
      '2001:db8::1',
      '2001:db8:1::1',
      '::ffff:127.0.0.1',
      '::ffff:10.0.0.1',
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
    expect(
      await checkSourceUrl(
        'https://example.com/docs',
        deps(() => page(200)),
      ),
    ).toBe(true);
  });

  it('accepts a plain-text page', async () => {
    expect(
      await checkSourceUrl(
        'https://example.com/a.txt',
        deps(() => page(200, 'text/plain')),
      ),
    ).toBe(true);
  });

  it('refuses a missing page', async () => {
    expect(
      await checkSourceUrl(
        'https://example.com/missing',
        deps(() => page(404)),
      ),
    ).toBe(false);
  });

  it('refuses a binary or unknown content type', async () => {
    expect(
      await checkSourceUrl(
        'https://example.com/file',
        deps(() => page(200, 'application/octet-stream')),
      ),
    ).toBe(false);
  });

  it('never makes a request when any address of the host is non-public', async () => {
    const d = deps(() => page(200), [PUBLIC_IP, '192.168.1.10']);
    expect(await checkSourceUrl('https://mixed.example/doc', d)).toBe(false);
    expect(d.request).not.toHaveBeenCalled();
  });

  it('never makes a request when the host resolves to a private address only', async () => {
    const d = deps(() => page(200), ['192.168.1.10']);
    expect(await checkSourceUrl('https://intranet.example/doc', d)).toBe(false);
    expect(d.request).not.toHaveBeenCalled();
  });

  it('connects to the address it checked, not to a name it resolves again', async () => {
    const d = deps(() => page(200), [PUBLIC_IP]);
    await checkSourceUrl('https://example.com/docs', d);
    expect(d.request).toHaveBeenCalledWith(expect.any(URL), PUBLIC_IP, expect.any(Number));
  });

  it("checks each redirect hop, pinning it to that hop's own address", async () => {
    const lookup = vi.fn(async (hostname: string) =>
      hostname === 'old.example' ? ['93.184.216.34'] : ['93.184.216.35'],
    );
    const request = vi.fn(async (url: URL, _address: string): Promise<SourceAnswer> =>
      url.hostname === 'old.example'
        ? page(301, 'text/html', 'https://new.example/page')
        : page(200),
    );
    const d: SourceCheckDeps = { lookup, request };
    expect(await checkSourceUrl('https://old.example/start', d)).toBe(true);
    expect(request.mock.calls.map((call) => call[1])).toEqual(['93.184.216.34', '93.184.216.35']);
  });

  it('follows a redirect to another https page and checks that page too', async () => {
    const d = deps((url) => (url.pathname === '/old' ? page(301, 'text/html', '/new') : page(200)));
    expect(await checkSourceUrl('https://example.com/old', d)).toBe(true);
    expect(d.request).toHaveBeenCalledTimes(2);
  });

  it('refuses a redirect that leaves https', async () => {
    const d = deps(() => page(302, 'text/html', 'http://example.com/plain'));
    expect(await checkSourceUrl('https://example.com/start', d)).toBe(false);
    expect(d.request).toHaveBeenCalledTimes(1);
  });

  it('refuses a redirect to a private address', async () => {
    const d = deps((url) =>
      url.hostname === 'example.com'
        ? page(302, 'text/html', 'https://internal.example/')
        : page(200),
    );
    d.lookup = async (hostname: string) =>
      hostname === 'example.com' ? [PUBLIC_IP] : ['10.0.0.5'];
    expect(await checkSourceUrl('https://example.com/start', d)).toBe(false);
    expect(d.request).toHaveBeenCalledTimes(1);
  });

  it('gives up after too many redirects', async () => {
    const d = deps(() => page(302, 'text/html', '/again'));
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
      request: vi.fn(async () => page(200)),
      lookup: async () => {
        throw new Error('ENOTFOUND');
      },
    };
    expect(await checkSourceUrl('https://nowhere.invalid/', d)).toBe(false);
    expect(d.request).not.toHaveBeenCalled();
  });

  it('refuses an address that is not https before any lookup', async () => {
    const d = deps(() => page(200));
    expect(await checkSourceUrl('http://example.com/a', d)).toBe(false);
    expect(d.request).not.toHaveBeenCalled();
  });
});
