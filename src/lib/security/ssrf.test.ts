import { describe, it, expect } from 'vitest';
import {
  isPrivateIp,
  isBlockedHostname,
  isIpLiteral,
  validateProxyUrl,
  proxyFetch,
  type LookupFn,
} from './ssrf';

const publicLookup: LookupFn = async () => [{ address: '140.82.121.3', family: 4 }];
const neverLookup: LookupFn = async () => {
  throw new Error('lookup should not be called');
};

describe('isPrivateIp', () => {
  it('flags IPv4 private, loopback, link-local and reserved ranges', () => {
    for (const ip of [
      '10.0.0.1',
      '172.16.5.4',
      '172.31.255.255',
      '192.168.1.1',
      '127.0.0.1',
      '0.0.0.0',
      '169.254.169.254', // cloud metadata endpoint
      '100.64.0.1', // CGNAT
      '224.0.0.1', // multicast
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('allows public IPv4 addresses', () => {
    for (const ip of ['140.82.121.3', '8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1']) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it('flags IPv6 loopback, link-local and unique-local addresses', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '[::1]']) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it('flags IPv4-mapped IPv6 pointing at a private address', () => {
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
  });

  it('allows a public IPv6 address', () => {
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });

  it('fails closed on malformed IPv4', () => {
    expect(isPrivateIp('999.1.1.1')).toBe(true);
  });
});

describe('isBlockedHostname', () => {
  it('blocks internal-only hostnames', () => {
    for (const h of ['localhost', 'foo.localhost', 'db.internal', 'printer.local', '']) {
      expect(isBlockedHostname(h), h).toBe(true);
    }
  });

  it('allows normal public hostnames', () => {
    for (const h of ['github.com', 'api.github.com', 'gitea.example.com']) {
      expect(isBlockedHostname(h), h).toBe(false);
    }
  });
});

describe('isIpLiteral', () => {
  it('recognises IPv4 and IPv6 literals but not names', () => {
    expect(isIpLiteral('127.0.0.1')).toBe(true);
    expect(isIpLiteral('::1')).toBe(true);
    expect(isIpLiteral('[::1]')).toBe(true);
    expect(isIpLiteral('github.com')).toBe(false);
  });
});

describe('validateProxyUrl', () => {
  it('rejects non-HTTPS URLs', async () => {
    const v = await validateProxyUrl('http://github.com/x', neverLookup);
    expect(v).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects unparseable URLs', async () => {
    const v = await validateProxyUrl('not a url', neverLookup);
    expect(v).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects internal hostnames without hitting DNS', async () => {
    const v = await validateProxyUrl('https://localhost/x', neverLookup);
    expect(v).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects private IP literals without hitting DNS', async () => {
    for (const url of [
      'https://127.0.0.1/x',
      'https://169.254.169.254/latest/meta-data/',
      'https://[::1]/x',
      'https://10.0.0.5/x',
    ]) {
      const v = await validateProxyUrl(url, neverLookup);
      expect(v, url).toMatchObject({ ok: false, status: 403 });
    }
  });

  it('blocks decimal IPv4 that the URL parser normalises to a loopback address', async () => {
    // new URL('https://2130706433') -> hostname 127.0.0.1
    const v = await validateProxyUrl('https://2130706433/x', publicLookup);
    expect(v).toMatchObject({ ok: false, status: 403 });
  });

  it('allows a public IP literal', async () => {
    const v = await validateProxyUrl('https://140.82.121.3/x', neverLookup);
    expect(v.ok).toBe(true);
  });

  it('blocks a public hostname that resolves to a private address', async () => {
    const rebind: LookupFn = async () => [{ address: '127.0.0.1', family: 4 }];
    const v = await validateProxyUrl('https://evil.example.com/x', rebind);
    expect(v).toMatchObject({ ok: false, status: 403 });
  });

  it('allows a public hostname that resolves to a public address', async () => {
    const v = await validateProxyUrl('https://api.github.com/x', publicLookup);
    expect(v.ok).toBe(true);
  });

  it('returns 502 when DNS resolution fails or is empty', async () => {
    const empty: LookupFn = async () => [];
    expect(await validateProxyUrl('https://api.github.com/x', empty)).toMatchObject({
      ok: false,
      status: 502,
    });
  });
});

describe('proxyFetch', () => {
  function recordingFetch(responders: Array<(url: string) => Response>) {
    const calls: Array<{ url: string; auth?: string }> = [];
    let i = 0;
    const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: u, auth: headers['Authorization'] });
      const responder = responders[Math.min(i, responders.length - 1)];
      i++;
      return responder(u);
    }) as unknown as typeof fetch;
    return { fetchFn, calls };
  }

  it('returns the upstream response on a direct 200', async () => {
    const { fetchFn, calls } = recordingFetch([() => new Response('zip', { status: 200 })]);
    const result = await proxyFetch({
      url: 'https://140.82.121.3/archive.zip',
      authHeader: 'Bearer secret',
      fetchFn,
      lookupFn: neverLookup,
    });
    expect(result.ok).toBe(true);
    expect(result.response?.status).toBe(200);
    expect(calls[0].auth).toBe('Bearer secret'); // sent to the original host
  });

  it('follows a redirect and drops Authorization when the origin changes', async () => {
    const { fetchFn, calls } = recordingFetch([
      () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://codeload.github.com/zip' },
        }),
      () => new Response('zip', { status: 200 }),
    ]);

    const result = await proxyFetch({
      url: 'https://api.github.com/repos/o/r/zipball/main',
      authHeader: 'Bearer secret',
      fetchFn,
      lookupFn: publicLookup,
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0].auth).toBe('Bearer secret'); // same-origin first hop
    expect(calls[1].auth).toBeUndefined(); // cross-origin hop: token stripped
  });

  it('keeps Authorization on a same-origin redirect', async () => {
    const { fetchFn, calls } = recordingFetch([
      () =>
        new Response(null, {
          status: 301,
          headers: { location: 'https://api.github.com/v2/zip' },
        }),
      () => new Response('zip', { status: 200 }),
    ]);

    await proxyFetch({
      url: 'https://api.github.com/v1/zip',
      authHeader: 'Bearer secret',
      fetchFn,
      lookupFn: publicLookup,
    });

    expect(calls[1].auth).toBe('Bearer secret');
  });

  it('blocks a redirect that points at a private address', async () => {
    const { fetchFn } = recordingFetch([
      () =>
        new Response(null, {
          status: 302,
          headers: { location: 'https://169.254.169.254/latest/meta-data/' },
        }),
    ]);

    const result = await proxyFetch({
      url: 'https://api.github.com/repos/o/r/zipball/main',
      authHeader: 'Bearer secret',
      fetchFn,
      lookupFn: publicLookup,
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it('rejects an initial private target without calling fetch', async () => {
    let called = false;
    const fetchFn = (async () => {
      called = true;
      return new Response('', { status: 200 });
    }) as unknown as typeof fetch;

    const result = await proxyFetch({
      url: 'https://127.0.0.1/x',
      fetchFn,
      lookupFn: neverLookup,
    });

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(called).toBe(false);
  });

  it('gives up after too many redirects', async () => {
    let n = 0;
    const fetchFn = (async () => {
      n++;
      return new Response(null, {
        status: 302,
        headers: { location: `https://api.github.com/hop/${n}` },
      });
    }) as unknown as typeof fetch;

    const result = await proxyFetch({
      url: 'https://api.github.com/start',
      fetchFn,
      lookupFn: publicLookup,
      maxRedirects: 2,
    });

    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});
