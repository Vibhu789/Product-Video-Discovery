import { resolveProduct } from '../src/services/productResolver.js';
import { analyzeProduct } from '../src/services/brain.js';
import { collectAll } from '../src/collectors/index.js';

const arg = process.argv[2];
const product = await resolveProduct(arg.startsWith('http') ? { url: arg } : { query: arg });
const { analysis } = await analyzeProduct(product);

const res = await collectAll({
  analysis, need: 10,
  onProgress: (p) => console.log(`[${p.platform}] searching "${p.term}" (${p.have}/${p.need})`),
});

for (const [src, r] of Object.entries(res)) {
  console.log(`\n== ${src}: ${r.videos.length} videos, shortfall ${r.shortfall}`);
  console.log('notes:', r.notes);
  console.log(r.videos.slice(0, 3));
}