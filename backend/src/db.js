import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS searches (
  id TEXT PRIMARY KEY,
  input_type TEXT NOT NULL,        -- keyword | url | image
  input TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',  -- queued|running|done|failed
  product_json TEXT,               -- title, image, attributes
  shortfall_json TEXT,             -- {instagram: 3, meta: 0}
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_id TEXT NOT NULL REFERENCES searches(id),
  platform TEXT NOT NULL,          -- instagram | meta | tiktok
  video_key TEXT NOT NULL,         -- platform id, or hash of media URL
  url TEXT NOT NULL,
  thumbnail TEXT,
  caption TEXT,
  posted_at INTEGER,
  phash TEXT,                      -- perceptual hash of thumbnail
  score INTEGER,
  reason TEXT,
  below_threshold INTEGER DEFAULT 0,
  UNIQUE(search_id, video_key)
);
CREATE INDEX IF NOT EXISTS idx_videos_key ON videos(platform, video_key);

CREATE TABLE IF NOT EXISTS product_cache (
  cache_key TEXT PRIMARY KEY,      -- sha256 of normalized URL or image
  product_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`);

function addColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
addColumn('videos', 'thumb_blob', 'BLOB');
addColumn('searches', 'error', 'TEXT');
addColumn('searches', 'options_json', 'TEXT');