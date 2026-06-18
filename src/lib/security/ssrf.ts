import { lookup } from 'node:dns/promises';

/**
 * SSRF protection for the archive proxy.
 *
 * The proxy forwards a caller-supplied URL (and the caller's Authorization
 * header) server-side. Without guards that turns the server into a confused
 * deputy: an attacker could point it at internal services (cloud metadata
 * endpoints, databases, admin panels) reachable from the server but not the
 * internet, or exfiltrate the bearer token to a host they control.
 *
 * Defences applied here:
 *  - HTTPS only.
 *  - Reject hostnames that resolve to private / loopback / link-local /
 *    reserved IP ranges (checked for IP literals directly and for DNS names
 *    after resolution, so a public name pointing at 127.0.0.1 is still blocked).
 *  - Reject internal-only hostnames (localhost, *.local, *.internal).
 *  - Re-validate every redirect hop (an open redirect on an allowed host must
 *    not be a bypass) and bound the number of hops.
 *  - Drop the Authorization header on cross-origin redirects so the token is
 *    only ever sent to the host the caller originally targeted.
 */

export type DnsRecord = { address: string; family: number };
export type LookupFn = (hostname: string) => Promise<DnsRecord[]>;

const defaultLookup: LookupFn = (hostname) => lookup(hostname, { all: true });

export interface UrlVerdict {
  ok: boolean;
  status?: number;
  error?: string;
}

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function stripBrackets(host: string): string {
  return host.replace(/^\[/, '').replace(/\]$/, '');
}

export function isIpLiteral(host: string): boolean {
  const h = stripBrackets(host);
  return IPV4_RE.test(h) || h.includes(':');
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  // Malformed quads are treated as private (fail closed).
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const h = ip.toLowerCase();
  if (h === '::1') return true; // loopback
  if (h === '::') return true; // unspecified
  if (/^fe[89ab]/.test(h)) return true; // link-local fe80::/10
  if (/^f[cd]/.test(h)) return true; // unique local fc00::/7
  return false;
}

/** True for any address in a private, loopback, link-local or reserved range. */
export function isPrivateIp(ip: string): boolean {
  const host = stripBrackets(ip.trim().toLowerCase());
  if (IPV4_RE.test(host)) return isPrivateIpv4(host);
  if (host.includes(':')) {
    // IPv4-mapped IPv6, e.g. ::ffff:127.0.0.1
    const mapped = host.match(/:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    return isPrivateIpv6(host);
  }
  return false;
}

/** True for hostnames that only ever name internal resources. */
export function isBlockedHostname(hostname: string): boolean {
  const h = stripBrackets(hostname.trim().toLowerCase());
  if (!h) return true;
  if (h === 'localhost') return true;
  return h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal');
}

/**
 * Validates a single URL: parseable, HTTPS, not an internal hostname, and not
 * resolving to a private address. DNS resolution is injectable for testing.
 */
export async function validateProxyUrl(
  rawUrl: string,
  lookupFn: LookupFn = defaultLookup
): Promise<UrlVerdict> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, status: 400, error: 'Invalid url parameter' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, status: 400, error: 'Only HTTPS URLs are allowed' };
  }

  const hostname = stripBrackets(url.hostname.toLowerCase());

  if (isBlockedHostname(hostname)) {
    return { ok: false, status: 403, error: 'Blocked host' };
  }

  // IP literals can be checked without a DNS round-trip. The WHATWG URL parser
  // normalises decimal/octal/hex IPv4 forms (e.g. 0x7f000001) to dotted quads,
  // so those bypass tricks are covered here too.
  if (isIpLiteral(hostname)) {
    return isPrivateIp(hostname)
      ? { ok: false, status: 403, error: 'Blocked private address' }
      : { ok: true };
  }

  let records: DnsRecord[];
  try {
    records = await lookupFn(hostname);
  } catch {
    return { ok: false, status: 502, error: 'DNS resolution failed' };
  }
  if (!records.length) {
    return { ok: false, status: 502, error: 'DNS resolution failed' };
  }
  for (const r of records) {
    if (isPrivateIp(r.address)) {
      return { ok: false, status: 403, error: 'Blocked private address' };
    }
  }
  return { ok: true };
}

function safeOrigin(rawUrl: string): string {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return '';
  }
}

export interface ProxyResult {
  ok: boolean;
  status?: number;
  error?: string;
  response?: Response;
}

/**
 * Fetches `url` while manually following redirects, validating every hop and
 * dropping the Authorization header once a redirect leaves the original origin.
 * `fetchFn` and `lookupFn` are injectable so the redirect/auth logic can be
 * unit-tested without network access.
 */
export async function proxyFetch(opts: {
  url: string;
  authHeader?: string | null;
  fetchFn?: typeof fetch;
  lookupFn?: LookupFn;
  maxRedirects?: number;
}): Promise<ProxyResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const lookupFn = opts.lookupFn ?? defaultLookup;
  const maxRedirects = opts.maxRedirects ?? 5;
  const initialOrigin = safeOrigin(opts.url);

  let currentUrl = opts.url;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const verdict = await validateProxyUrl(currentUrl, lookupFn);
    if (!verdict.ok) return verdict;

    const headers: Record<string, string> = {};
    if (opts.authHeader && safeOrigin(currentUrl) === initialOrigin) {
      headers['Authorization'] = opts.authHeader;
    }

    const response = await fetchFn(currentUrl, {
      method: 'GET',
      headers,
      redirect: 'manual',
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { ok: true, response };
      try {
        currentUrl = new URL(location, currentUrl).toString();
      } catch {
        return { ok: false, status: 502, error: 'Invalid redirect location' };
      }
      continue;
    }

    return { ok: true, response };
  }

  return { ok: false, status: 502, error: 'Too many redirects' };
}
