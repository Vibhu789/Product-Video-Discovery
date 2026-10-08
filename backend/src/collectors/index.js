import { withTimeout } from '../lib/retry.js';
import { logger } from '../logger.js';
import { collectInstagram } from './instagram.js';
import { collectMeta } from './meta.js';

const SOURCE_TIMEOUT_MS = 5 * 60_000;

export async function collectAll({ analysis, need, accept, onProgress }) {
  const sources = { instagram: collectInstagram, meta: collectMeta };
  const names = Object.keys(sources);

  const settled = await Promise.allSettled(
    names.map((n) => withTimeout(sources[n]({ analysis, need, accept, onProgress }), SOURCE_TIMEOUT_MS, `${n} collection`)),
  );

  const out = {};
  settled.forEach((r, i) => {
    const name = names[i];
    if (r.status === 'fulfilled') out[name] = r.value;
    else {
      logger.error({ source: name, err: r.reason?.message }, 'source failed');
      out[name] = { videos: [], shortfall: need, notes: [r.reason?.message || 'Unknown error'], error: r.reason?.message };
    }
  });
  return out;
}