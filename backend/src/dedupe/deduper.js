import PQueue from 'p-queue';
import { mediaKey, captionFingerprint } from './keys.js';
import { dHash, hamming } from './phash.js';
import { getThumbnail } from '../lib/thumbs.js';
import { logger } from '../logger.js';

export const NEAR_DUP_DISTANCE = 6; // out of 64 bits; tune with real data

// // Thumbnail URLs come from third-party data, so they go through the SSRF-safe fetcher too.
// async function hashThumbnail(video) {
//   if (!video.thumbnail) return null;
//   const { body } = await safeFetch(video.thumbnail, { maxBytes: 2_000_000, timeoutMs: 8000 });
//   return dHash(body);
// }
async function hashThumbnail(video) {
  if (!video.thumbnail) return null;
  const { body } = await getThumbnail(video.thumbnail);
  return dHash(body);
}

export class Deduper {
  constructor({
    seenKeys = new Set(), historyHashes = [], includeSeen = false,
    nearDistance = NEAR_DUP_DISTANCE, hashFn = hashThumbnail,
  } = {}) {
    this.seenKeys = seenKeys;
    this.historyHashes = historyHashes;
    this.includeSeen = includeSeen;
    this.nearDistance = nearDistance;
    this.hashFn = hashFn;
    this.fingerprints = new Set();
    this.keptHashes = [];
    this.stats = {
      alreadySeen: 0, sameKey: 0, sameMedia: 0, sameCaption: 0,
      sameAdGroup: 0, nearDupInSearch: 0, nearDupEarlier: 0,
    };
  }

  #drop(reason) { this.stats[reason]++; return false; }

  /** Synchronous and cheap, so it can run inside the collector loop. Stateful by design. */
  accept(v) {
    const id = `${v.platform}:${v.videoKey}`;
    if (!this.includeSeen && this.seenKeys.has(id)) return this.#drop('alreadySeen');

    const mk = mediaKey(v.videoUrl);
    const fp = captionFingerprint(v.caption);
    const checks = [
      ['sameKey', `id:${id}`],
      ['sameMedia', mk && `media:${v.platform}:${mk}`],
      ['sameCaption', fp && `cap:${v.platform}:${fp}`],
      ['sameAdGroup', v.groupKey && `grp:${v.platform}:${v.groupKey}`],
    ];
    for (const [reason, key] of checks) {
      if (key && this.fingerprints.has(key)) return this.#drop(reason);
    }
    for (const [, key] of checks) if (key) this.fingerprints.add(key);
    return true;
  }

  /** Async pass: drops visual near-duplicates. A video whose thumbnail cannot be hashed is kept, not guessed about. */
  async refine(videos, { concurrency = 5 } = {}) {
    const queue = new PQueue({ concurrency });
    await Promise.all(videos.map((v) => queue.add(async () => {
      try { v.phash = await this.hashFn(v); }
      catch (e) { v.phash = null; logger.debug({ err: e.message, url: v.url }, 'thumbnail hash failed'); }
    })));

    const kept = [];
    const dropped = [];
    for (const v of videos) {
      if (v.phash) {
        if (this.keptHashes.some((h) => hamming(h, v.phash) <= this.nearDistance)) {
          this.stats.nearDupInSearch++;
          dropped.push({ video: v, reason: 'near-duplicate of another video in this search' });
          continue;
        }
        if (!this.includeSeen && this.historyHashes.some((h) => hamming(h, v.phash) <= this.nearDistance)) {
          this.stats.nearDupEarlier++;
          dropped.push({ video: v, reason: 'near-duplicate of a video from an earlier search' });
          continue;
        }
        this.keptHashes.push(v.phash);
      }
      kept.push(v);
    }
    return { kept, dropped };
  }
}