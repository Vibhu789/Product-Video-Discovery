import crypto from 'node:crypto';
import { db } from '../src/db.js';
import { resolveProduct } from '../src/services/productResolver.js';
import { analyzeProduct } from '../src/services/brain.js';
import { collectAll } from '../src/collectors/index.js';
import { Deduper } from '../src/dedupe/deduper.js';
import { loadHistory, saveVideos } from '../src/dedupe/history.js';

const query = process.argv[2];
const includeSeen = process.argv.includes('--include-seen');

const product = await resolveProduct({ query });
const { analysis } = await analyzeProduct(product);

const { seenKeys, historyHashes } = loadHistory();
console.log(`history: ${seenKeys.size} videos seen before`);

const dedupe = new Deduper({ seenKeys, historyHashes, includeSeen });
const res = await collectAll({ analysis, need: 10, accept: (v) => dedupe.accept(v) });

const searchId = crypto.randomUUID();
db.prepare('INSERT INTO searches (id, input_type, input, status, created_at) VALUES (?, ?, ?, ?, ?)')
  .run(searchId, 'keyword', query, 'done', Date.now());

for (const [src, r] of Object.entries(res)) {
  const { kept, dropped } = await dedupe.refine(r.videos);
  console.log(`\n${src}: collected ${r.videos.length}, kept ${kept.length}, near-dups dropped ${dropped.length}, shortfall ${r.shortfall}`);
  dropped.forEach((d) => console.log('  dropped:', d.video.url, '->', d.reason));
  saveVideos(searchId, kept);
}
console.log('\nfilter stats:', dedupe.stats);