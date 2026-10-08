import { db } from '../db.js';

export function loadHistory(hashLimit = 5000) {
  // Videos that failed scoring were never judged, so they are allowed to come back.
  const seenKeys = new Set(
    db.prepare('SELECT platform, video_key FROM videos WHERE score IS NOT NULL')
      .all().map((r) => `${r.platform}:${r.video_key}`),
  );
  const historyHashes = db
    .prepare('SELECT phash FROM videos WHERE phash IS NOT NULL AND score IS NOT NULL ORDER BY id DESC LIMIT ?')
    .all(hashLimit)
    .map((r) => r.phash);
  return { seenKeys, historyHashes };
}

// /** Call only with videos that were actually shown to the user. */
// export function saveVideos(searchId, videos) {
//   const stmt = db.prepare(`
//     INSERT OR IGNORE INTO videos
//       (search_id, platform, video_key, url, thumbnail, caption, posted_at, phash, score, reason, below_threshold)
//     VALUES (@searchId, @platform, @videoKey, @url, @thumbnail, @caption, @postedAt, @phash, @score, @reason, @below)`);
//   db.transaction((list) => {
//     for (const v of list) {
//       stmt.run({
//         searchId, platform: v.platform, videoKey: v.videoKey, url: v.url,
//         thumbnail: v.thumbnail ?? null, caption: v.caption ?? '', postedAt: v.postedAt ?? null,
//         phash: v.phash ?? null, score: v.score ?? null, reason: v.reason ?? null, below: v.belowThreshold ? 1 : 0,
//       });
//     }
//   })(videos);
// }

export function saveVideos(searchId, videos) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO videos
      (search_id, platform, video_key, url, thumbnail, caption, posted_at, phash, score, reason, below_threshold, thumb_blob)
    VALUES (@searchId, @platform, @videoKey, @url, @thumbnail, @caption, @postedAt, @phash, @score, @reason, @below, @thumbBlob)`);
  db.transaction((list) => {
    for (const v of list) {
      stmt.run({
        searchId, platform: v.platform, videoKey: v.videoKey, url: v.url,
        thumbnail: v.thumbnail ?? null, caption: v.caption ?? '', postedAt: v.postedAt ?? null,
        phash: v.phash ?? null, score: v.score ?? null, reason: v.reason ?? null,
        below: v.belowThreshold ? 1 : 0, thumbBlob: v.thumbBlob ?? null,
      });
    }
  })(videos);
}