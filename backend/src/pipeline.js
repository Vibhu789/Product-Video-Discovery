import sharp from 'sharp';
import PQueue from 'p-queue';
import { config } from './config.js';
import { logger } from './logger.js';
import { withTimeout } from './lib/retry.js';
import { getThumbnail } from './lib/thumbs.js';
import { resolveProduct } from './services/productResolver.js';
import { analyzeProduct } from './services/brain.js';
import { scoreVideos } from './services/scorer.js';
import { Deduper } from './dedupe/deduper.js';
import { loadHistory, saveVideos } from './dedupe/history.js';
import { collectInstagram } from './collectors/instagram.js';
import { collectMeta } from './collectors/meta.js';
import { updateSearch } from './repo.js';

const MAX_ROUNDS = 3;
const ROUND_TIMEOUT_MS = 5 * 60_000;

const SOURCES = {
  instagram: { label: 'Instagram Reels', collect: collectInstagram },
  meta: { label: 'Meta Ad Library', collect: collectMeta },
};

// function tally(videos) {
//   const belowThreshold = videos.filter((v) => v.belowThreshold).length;
//   const unscored = videos.filter((v) => v.unscored).length;
//   // "usable" = not below the match threshold (unscored videos stay visible and flagged)
//   return { total: videos.length, usable: videos.length - belowThreshold, belowThreshold, unscored, target: config.minPerSource };
// }
function tally(videos) {
  const unscored = videos.filter((v) => v.unscored).length;
  const belowThreshold = videos.filter((v) => v.belowThreshold).length;
  // "usable" = scored AND at or above the threshold. Unscored videos are shown, but never count toward the target.
  return { total: videos.length, usable: videos.length - unscored - belowThreshold, belowThreshold, unscored, target: config.minPerSource };
}

async function previewDataUrl(image) {
  if (!image) return null;
  try {
    const buf = await sharp(Buffer.from(image.base64, 'base64')).resize(480, 480, { fit: 'inside' }).jpeg({ quality: 72 }).toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch { return null; }
}

async function attachThumbnails(videos) {
  const q = new PQueue({ concurrency: 5 });
  await Promise.all(videos.map((v) => q.add(async () => {
    try {
      const t = await getThumbnail(v.thumbnail);
      v.thumbBlob = await sharp(t.body).resize(360, 360, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
    } catch { v.thumbBlob = null; }
  })));
}

/** One source, start to finish. Never throws: failures become notes so the other source is unaffected. */
async function runSource({ name, ctx }) {
  const { analysis, product, history, includeSeen, emit } = ctx;
  const min = config.minPerSource;
  const dedupe = new Deduper({ ...history, includeSeen });
  const state = { name, videos: [], notes: [], error: null, searches: 0, dedupe };
  let skip = 0;

  try {
        for (let round = 1; round <= MAX_ROUNDS; round++) {
      const have = tally(state.videos).usable;
      if (have >= min) break;
      const need = round === 1 ? min + 10 : Math.max(10, (min - have) * 2); // over-fetch: some fail the threshold

      emit({ type: 'stage', stage: `search_${name}`, status: 'running', label: `Searching ${SOURCES[name].label}`, round });
      const r = await withTimeout(
        SOURCES[name].collect({
          analysis, need, skip, accept: (v) => dedupe.accept(v),
          onProgress: (p) => emit({ type: 'progress', source: name, term: p.term, have: p.have, need: p.need }),
        }),
        ROUND_TIMEOUT_MS, `${name} collection`,
      );

      if (r.searchesUsed === 0) {
        state.notes.push('All search variations were already used.');
        break;
      }
      skip += r.searchesUsed;
      state.searches += r.searchesUsed;
      state.notes.push(...r.notes);
      if (r.error) state.error = r.error;

      let scoringDown = false;
      if (r.videos.length) {
        emit({ type: 'stage', stage: `score_${name}`, status: 'running', label: `Scoring ${SOURCES[name].label}` });
        const { kept } = await dedupe.refine(r.videos);
        const scoring = await scoreVideos({ product, analysis, videos: kept });
        scoringDown = kept.length > 0 && scoring.unscored > kept.length / 2;
        if (scoringDown) {
          const why = String(kept.find((v) => v.unscored)?.reason || '').slice(0, 160);
          const msg = `${SOURCES[name].label}: most videos could not be scored, so the ranking is unreliable. ${why}`;
          state.notes.push(msg);
          emit({ type: 'warning', message: msg });
        }
        state.videos.push(...kept);
      }
      emit({ type: 'counts', source: name, ...tally(state.videos) });
      if (r.error || scoringDown) break; // fetching more videos does not help if they cannot be scored
    }
  } catch (e) {
    logger.error({ source: name, err: e.message }, 'source pipeline failed');
    state.error = e.message;
    state.notes.push(e.message);
  }

  emit({ type: 'stage', stage: `search_${name}`, status: 'done' });
  emit({ type: 'stage', stage: `score_${name}`, status: 'done' });
  return state;
}

function hintFor(e, input) {
  if (e.status === 400) return 'Check the URL and try again.';
  if (input.url) return 'Try the product name instead, or upload the product image.';
  return 'Try a more specific product name, or upload a product image.';
}

export async function runSearch({ searchId, input, emit }) {
  updateSearch(searchId, { status: 'running' });
  const warnings = [];
  const warn = (message) => { warnings.push(message); emit({ type: 'warning', message }); };

  try {
    emit({ type: 'stage', stage: 'fetch_page', status: 'running', label: input.url ? 'Fetching product page' : 'Preparing product' });
    const product = await resolveProduct(input);
    product.warnings.forEach(warn);
    emit({ type: 'stage', stage: 'fetch_page', status: 'done' });

    emit({ type: 'stage', stage: 'analyse_image', status: 'running', label: 'Analysing product image' });
    const { analysis, warnings: analysisWarnings } = await analyzeProduct(product);
    analysisWarnings.forEach(warn);
    const productView = {
      title: product.title, description: product.description, sourceUrl: product.sourceUrl,
      previewDataUrl: await previewDataUrl(product.image), analysis, warnings: [...warnings],
    };
    updateSearch(searchId, { product_json: JSON.stringify(productView) });
    emit({ type: 'product', product: productView });
    emit({ type: 'stage', stage: 'analyse_image', status: 'done' });

    const ctx = { analysis, product, history: loadHistory(), includeSeen: input.includeSeen, emit };
    const states = await Promise.all(Object.keys(SOURCES).map((name) => runSource({ name, ctx })));

    emit({ type: 'stage', stage: 'finalize', status: 'running', label: 'Saving results' });
    const all = states.flatMap((s) => s.videos);
    if (all.length === 0 && states.some((s) => s.error)) {
      throw new Error(states.find((s) => s.error).error);
    }
    await attachThumbnails(all);
    saveVideos(searchId, all);

    const summary = {};
    for (const s of states) {
      const t = tally(s.videos);
      summary[s.name] = {
        ...t, shortfall: Math.max(0, config.minPerSource - t.usable), searches: s.searches,
        notes: s.notes.slice(0, 10), error: s.error, filtered: s.dedupe.stats,
      };
    }
    updateSearch(searchId, { status: 'done', shortfall_json: JSON.stringify(summary) });
    emit({ type: 'stage', stage: 'finalize', status: 'done' });
    emit({ type: 'done', summary });
  } catch (e) {
    logger.error({ searchId, err: e.message }, 'search failed');
    updateSearch(searchId, { status: 'failed', error: e.message });
    emit({ type: 'error', message: e.message, hint: hintFor(e, input) });
  }
}