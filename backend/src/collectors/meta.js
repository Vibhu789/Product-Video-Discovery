import { config } from '../config.js';
import { runActor } from './apifyRunner.js';
import { mapMeta } from './normalize.js';
import { collectUntil } from './loop.js';

// Ad Library search URL filtered to video ads. ADAPT the input shape to your actor.
function buildInput(term, limit) {
  const url = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL' +
    `&media_type=video&q=${encodeURIComponent(term)}&search_type=keyword_unordered`;
  return { startUrls: [{ url }], resultsLimit: limit };
}

// export function metaTerms(a) {
//   return [...a.queries.meta, ...a.expansionQueries];
// }
export function metaTerms(a) {
  const seen = new Set();
  return [...a.queries.meta, ...a.expansionQueries].filter((t) => {
    const k = t.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// export function collectMeta({ analysis, need, accept, onProgress }) {
//   return collectUntil({
//     platform: 'meta', terms: metaTerms(analysis), need, accept, onProgress,
//     fetchTerm: async (term, limit) => {
//       const items = await runActor(config.metaActor, buildInput(term, limit), { limit: limit * 2 });
//       return items.map(mapMeta).filter(Boolean);
//     },
//   });
// }

export function collectMeta({ analysis, need, accept, onProgress, skip = 0 }) {
  return collectUntil({
    platform: 'meta', terms: metaTerms(analysis).slice(skip), need, accept, onProgress,
    fetchTerm: async (term, limit) => {
      const items = await runActor(config.metaActor, buildInput(term, limit), { limit: limit * 2 });
      return items.map(mapMeta).filter(Boolean);
    },
  });
}