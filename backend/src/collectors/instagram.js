import { config } from '../config.js';
import { runActor } from './apifyRunner.js';
import { mapInstagram } from './normalize.js';
import { collectUntil } from './loop.js';

// // ADAPT to your chosen actor's Input tab (field names differ per actor)
// function buildInput(term, limit) {
//   return term.startsWith('#')
//     ? { hashtags: [term.slice(1)], resultsLimit: limit }
//     : { search: term, resultsLimit: limit };
// }

const toTag = (t) => t.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ADAPT to the actor's Input tab if field names differ
function buildInput(term, limit) {
  return { hashtags: [toTag(term)], resultsType: 'reels', resultsLimit: limit };
}

// export function instagramTerms(a) {
//   return [
//     ...a.queries.instagram,
//     ...a.hashtags.slice(0, 5).map((h) => `#${h}`),
//     ...a.expansionQueries,
//   ];
// }

export function instagramTerms(a) {
  const all = [
    ...a.queries.instagram,
    ...a.hashtags.slice(0, 5).map((h) => `#${h}`),
    ...a.expansionQueries,
  ];
  const seen = new Set();
  return all.filter((t) => {
    const k = toTag(t);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// export function collectInstagram({ analysis, need, accept, onProgress }) {
//   return collectUntil({
//     platform: 'instagram', terms: instagramTerms(analysis), need, accept, onProgress,
//     fetchTerm: async (term, limit) => {
//       const items = await runActor(config.igActor, buildInput(term, limit), { limit: limit * 2 });
//       return items.map(mapInstagram).filter(Boolean);
//     },
//   });
// }

export function collectInstagram({ analysis, need, accept, onProgress, skip = 0 }) {
  return collectUntil({
    platform: 'instagram', terms: instagramTerms(analysis).slice(skip), need, accept, onProgress,
    fetchTerm: async (term, limit) => {
      const items = await runActor(config.igActor, buildInput(term, limit), { limit: limit * 2 });
      return items.map(mapInstagram).filter(Boolean);
    },
  });
}