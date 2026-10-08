import { withRetry } from '../lib/retry.js';

/**
 * Tries search terms in order until `need` accepted videos are collected.
 * fetchTerm(term, limit) -> normalized videos for that term
 * accept(video) -> false to skip (Step 5 plugs "already seen" in here)
 */
export async function collectUntil({
  platform, terms, need, fetchTerm, accept = () => true, onProgress, maxCalls = 8,
}) {
  const kept = new Map();
  const notes = [];
  let calls = 0;
  let fatal = null;

  for (const term of terms) {
    if (kept.size >= need) break;
    if (calls >= maxCalls) { notes.push(`Stopped after ${maxCalls} searches to protect your quota`); break; }
    calls++;
    onProgress?.({ platform, term, have: kept.size, need });

    let items;
    try {
      const limit = Math.ceil((need - kept.size) * 1.5) + 5; // over-fetch: some get filtered out
      items = await withRetry(() => fetchTerm(term, limit));
    } catch (e) {
      notes.push(`"${term}" failed: ${e.message}`);
      if (e.fatal) { fatal = e.message; break; }
      continue; // transient error: move on to the next term
    }

    for (const v of items) {
      if (v && !kept.has(v.videoKey) && accept(v)) kept.set(v.videoKey, v);
    }
  }

  const videos = [...kept.values()];
  const shortfall = Math.max(0, need - videos.length);
  if (shortfall) notes.push(`Only ${videos.length} of ${need} videos found after ${calls} searches`);
  return { videos, shortfall, notes, error: fatal, searchesUsed: calls };
}