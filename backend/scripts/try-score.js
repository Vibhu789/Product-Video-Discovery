import crypto from 'node:crypto';
import { db } from '../src/db.js';
import { config } from '../src/config.js';
import { resolveProduct } from '../src/services/productResolver.js';
import { analyzeProduct } from '../src/services/brain.js';
import { collectAll } from '../src/collectors/index.js';
import { Deduper } from '../src/dedupe/deduper.js';
import { loadHistory, saveVideos } from '../src/dedupe/history.js';
import { scoreVideos } from '../src/services/scorer.js';

const arg = process.argv[2];
const includeSeen = process.argv.includes('--include-seen');

const product = await resolveProduct(arg.startsWith('http') ? { url: arg } : { query: arg });
const { analysis, warnings } = await analyzeProduct(product);
console.log('\nPRODUCT:', product.title, '\nwarnings:', warnings);
console.log('distinguishing:', analysis.distinguishing, '| colours:', analysis.colors);

const { seenKeys, historyHashes } = loadHistory();
const dedupe = new Deduper({ seenKeys, historyHashes, includeSeen });
const res = await collectAll({ analysis, need: 10, accept: (v) => dedupe.accept(v) });

const searchId = crypto.randomUUID();
db.prepare('INSERT INTO searches (id, input_type, input, status, created_at) VALUES (?, ?, ?, ?, ?)')
  .run(searchId, arg.startsWith('http') ? 'url' : 'keyword', arg, 'done', Date.now());

for (const [src, r] of Object.entries(res)) {
  const { kept } = await dedupe.refine(r.videos);
  const summary = await scoreVideos({ product, analysis, videos: kept });
  console.log(`\n=== ${src}: ${JSON.stringify(summary)} (threshold ${config.matchThreshold})`);
  [...kept].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).forEach((v) => {
    const flag = v.unscored ? 'UNSCORED' : v.belowThreshold ? 'below' : 'ok';
    console.log(`${String(v.score ?? '--').padStart(3)} [${flag}] ${v.reason}\n      ${v.url}`);
  });
  saveVideos(searchId, kept);
}