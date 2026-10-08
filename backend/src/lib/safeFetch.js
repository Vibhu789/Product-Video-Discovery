import { assertSafeUrl, UnsafeUrlError } from './urlGuard.js';

const UA = 'Mozilla/5.0 (compatible; ProductVideoBot/1.0)';

export async function safeFetch(url, { timeoutMs = 10000, maxBytes = 5_000_000, maxRedirects = 4 } = {}) {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertSafeUrl(current);
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': UA, accept: 'text/html,image/*;q=0.9,*/*;q=0.5' },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    if (!res.ok) {
      const err = new Error(`Upstream responded ${res.status}`);
      err.status = 502;
      err.upstreamStatus = res.status; // 403/429 usually means a bot wall
      throw err;
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('Response too large');
      chunks.push(chunk);
    }
    return {
      finalUrl: current,
      contentType: res.headers.get('content-type') || '',
      body: Buffer.concat(chunks),
    };
  }
  throw new UnsafeUrlError('Too many redirects');
}