import { db } from './db.js';
import { config } from './config.js';

const COLUMNS = new Set(['status', 'product_json', 'shortfall_json', 'error']);
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

export function createSearch({ id, inputType, input, options }) {
  db.prepare(
    `INSERT INTO searches (id, input_type, input, status, created_at, options_json) VALUES (?, ?, ?, 'queued', ?, ?)`,
  ).run(id, inputType, input, Date.now(), JSON.stringify(options));
}

export function updateSearch(id, fields) {
  const keys = Object.keys(fields).filter((k) => COLUMNS.has(k));
  if (!keys.length) return;
  const params = Object.fromEntries(keys.map((k) => [k, fields[k]]));
  db.prepare(`UPDATE searches SET ${keys.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`).run({ ...params, id });
}

export function getSearchStatus(id) {
  const s = db.prepare('SELECT status, error, shortfall_json FROM searches WHERE id = ?').get(id);
  return s ? { status: s.status, error: s.error, summary: parse(s.shortfall_json) } : null;
}

export function getSearch(id) {
  const s = db.prepare('SELECT * FROM searches WHERE id = ?').get(id);
  if (!s) return null;
  const rows = db.prepare(`
    SELECT id, platform, url, thumbnail, caption, posted_at, score, reason, below_threshold,
           (thumb_blob IS NOT NULL) AS has_thumb
    FROM videos WHERE search_id = ? ORDER BY (score IS NULL), score DESC`).all(id);

  const videos = rows.map((r) => ({
    id: r.id,
    platform: r.platform,
    url: r.url,
    thumbnail: r.has_thumb ? `/api/video/${r.id}/thumb` : r.thumbnail,
    caption: r.caption,
    postedAt: r.posted_at,
    score: r.score,
    reason: r.reason,
    belowThreshold: !!r.below_threshold,
    unscored: r.score === null,
  }));

  return {
    id: s.id, status: s.status, inputType: s.input_type, input: s.input, createdAt: s.created_at,
    error: s.error, options: parse(s.options_json), product: parse(s.product_json),
    summary: parse(s.shortfall_json), threshold: config.matchThreshold, target: config.minPerSource, videos,
  };
}

export function listHistory(limit = 50) {
  return db.prepare(`
    SELECT s.id, s.input_type, s.input, s.status, s.created_at,
      json_extract(s.product_json, '$.title') AS title,
      COALESCE(SUM(CASE WHEN v.platform = 'instagram' AND v.below_threshold = 0 AND v.score IS NOT NULL THEN 1 END), 0) AS instagram,
      COALESCE(SUM(CASE WHEN v.platform = 'meta' AND v.below_threshold = 0 AND v.score IS NOT NULL  THEN 1 END), 0) AS meta,
      COUNT(v.id) AS total
    FROM searches s LEFT JOIN videos v ON v.search_id = s.id
    GROUP BY s.id ORDER BY s.created_at DESC LIMIT ?`).all(limit).map((r) => ({
    id: r.id, inputType: r.input_type, input: r.input, status: r.status, createdAt: r.created_at,
    title: r.title, counts: { instagram: r.instagram, meta: r.meta, total: r.total },
  }));
}

export function getThumbBlob(videoId) {
  return db.prepare('SELECT thumb_blob FROM videos WHERE id = ?').get(videoId)?.thumb_blob ?? null;
}