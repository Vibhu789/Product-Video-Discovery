import dns from 'node:dns/promises';
import net from 'node:net';

export class UnsafeUrlError extends Error {
  constructor(msg) { super(msg); this.status = 400; }
}

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||   // CGNAT
      (a === 169 && b === 254) ||             // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224                                // multicast / reserved
    );
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::' || l === '::1') return true;
    if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7)); // fails closed if hex form
    return /^f[cd]/.test(l) || /^fe[89ab]/.test(l);
  }
  return true; // not an IP at all: fail closed
}

export async function assertSafeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new UnsafeUrlError('Invalid URL'); }

  if (!['http:', 'https:'].includes(u.protocol)) throw new UnsafeUrlError('Only http(s) URLs are allowed');
  if (u.username || u.password) throw new UnsafeUrlError('URLs with credentials are not allowed');

  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new UnsafeUrlError('Internal hostnames are not allowed');
  }

  const addrs = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true }).catch(() => {
        throw new UnsafeUrlError('Could not resolve host');
      })).map((a) => a.address);

  if (!addrs.length || addrs.some(isPrivateIp)) {
    throw new UnsafeUrlError('URL points to a private or internal address');
  }
  return u;
}