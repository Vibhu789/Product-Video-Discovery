import { safeFetch } from './safeFetch.js';

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_ENTRIES = 150;
const cache = new Map(); // url -> Promise<{ body, mediaType }>

async function download(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await safeFetch(url, { maxBytes: 2_000_000, timeoutMs: 15_000 });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export function getThumbnail(url) {
  if (!url) return Promise.reject(new Error('No thumbnail URL'));
  if (cache.has(url)) return cache.get(url);

  const p = download(url).then(({ body, contentType }) => {
    const type = contentType.split(';')[0].trim().toLowerCase();
    return { body, mediaType: IMG_TYPES.includes(type) ? type : 'image/jpeg' };
  });
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  return p;
}