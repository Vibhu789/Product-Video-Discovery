import crypto from 'node:crypto';

export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/** CDN hostnames and signed query strings change between fetches; the path identifies the file. */
export function mediaKey(url) {
  if (!url) return null;
  try {
    const { pathname } = new URL(url);
    return pathname.length >= 12 ? pathname : null;
  } catch {
    return null;
  }
}

/** Same text with different hashtags/links/spacing -> same fingerprint. Short captions are too generic to trust. */
export function captionFingerprint(caption) {
  const text = String(caption || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#@]\S+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  return text.length >= 40 ? sha(text) : null;
}