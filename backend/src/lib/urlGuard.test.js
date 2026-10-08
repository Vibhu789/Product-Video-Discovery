import { describe, it, expect } from 'vitest';
import { isPrivateIp, assertSafeUrl } from './urlGuard.js';

describe('isPrivateIp', () => {
  it.each(['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', 'fe80::1'])(
    'blocks %s', (ip) => expect(isPrivateIp(ip)).toBe(true));
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    'allows %s', (ip) => expect(isPrivateIp(ip)).toBe(false));
});

describe('assertSafeUrl', () => {
  it.each([
    'http://localhost:3000', 'http://127.0.0.1', 'http://169.254.169.254/latest/meta-data',
    'file:///etc/passwd', 'ftp://example.com', 'http://user:pw@example.com', 'not a url',
  ])('rejects %s', async (u) => { await expect(assertSafeUrl(u)).rejects.toThrow(); });
});