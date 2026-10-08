import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.js';
import { logger } from '../logger.js';
import { askVision, extractJson } from './vision.js';

const list = z.array(z.string()).default([]);

export const analysisSchema = z.object({
  productType: z.string().default('unknown'),
  colors: list,
  prints: list,        // graphics, patterns, illustrations
  logos: list,         // brand marks
  textOnProduct: list, // slogans, labels, visible text
  material: z.string().default('unknown'),
  shape: z.string().default('unknown'),
  distinguishing: list, // the 2-4 features that make THIS product identifiable
  summary: z.string().default(''),
  queries: z.object({
    instagram: list,
    meta: list,
    tiktok: list,
  }).default({}),
  hashtags: list,
  expansionQueries: list, // broader fallbacks used when a source falls short
});

const SYSTEM = `You are a product-visual analyst for a video discovery tool.
Look at the product image and the page text, then describe the product so that
videos showing this EXACT product can be found and verified.

Rules:
- Describe only what is visible. Use "unknown" instead of guessing.
- "distinguishing" must hold the 2-4 visual features that separate this product
  from others in the same category (specific print, colourway, logo placement, shape detail).
- Queries are short (2-6 words), natural, the way people title posts or ads.
  Mix exact-product phrasing with category phrasing. No hashtags inside queries.
- instagram queries should read like reel captions or creator wording
  (e.g. "outfit of the day", "unboxing", "haul").
- meta queries should read like ad copy or brand/product wording
  (e.g. "new arrival", "shop now", brand name if a logo is visible).
- hashtags: 6-10 lowercase words without the # symbol, specific before generic.
- expansionQueries: 4 progressively broader queries for when results run short.
- At least two queries per platform must contain the brand and model/series name taken from the
  product title or logo (for example "Safari Cabin Genius trolley"), before any generic wording.

Reply with ONLY a JSON object with these keys:
productType, colors, prints, logos, textOnProduct, material, shape,
distinguishing, summary, queries{instagram,meta,tiktok}, hashtags, expansionQueries.`;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function sanitizeHashtags(tags) {
  const seen = new Set();
  for (const t of tags) {
    const clean = String(t).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean.length >= 3 && clean.length <= 30) seen.add(clean);
  }
  return [...seen].slice(0, 10);
}

export function dedupeQueries(qs, max = 6) {
  const seen = new Set();
  const out = [];
  for (const q of qs) {
    const clean = String(q).replace(/#/g, '').replace(/\s+/g, ' ').trim();
    const key = clean.toLowerCase();
    if (clean.length >= 2 && !seen.has(key)) {
      seen.add(key);
      out.push(clean);
    }
  }
  return out.slice(0, max);
}

function normalize(a) {
  return {
    ...a,
    hashtags: sanitizeHashtags(a.hashtags),
    expansionQueries: dedupeQueries(a.expansionQueries, 4),
    queries: {
      instagram: dedupeQueries(a.queries.instagram),
      meta: dedupeQueries(a.queries.meta),
      tiktok: dedupeQueries(a.queries.tiktok),
    },
  };
}

/** Text-only fallback when there is no image or the vision call fails. */
export function fallbackAnalysis(title) {
  const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  const base = title.trim().slice(0, 80);
  return normalize({
    productType: 'unknown', colors: [], prints: [], logos: [], textOnProduct: [],
    material: 'unknown', shape: 'unknown', distinguishing: [],
    summary: `Text-only analysis of "${base}"`,
    queries: { instagram: [base, `${base} review`], meta: [base, `${base} shop now`], tiktok: [base] },
    hashtags: [words.join(''), ...words].slice(0, 8),
    expansionQueries: [words.slice(0, 3).join(' '), words.slice(0, 2).join(' '), words[0] || base].filter(Boolean),
  });
}

/**
 * product: { title, description, image: {mediaType, base64} | null }
 * Returns { analysis, warnings }
 */
export async function analyzeProduct(product) {
  const warnings = [];
  const key = 'analysis:' + sha((product.image?.base64 || '') + '|' + product.title + '|' + product.description);

  const cached = db.prepare('SELECT product_json FROM product_cache WHERE cache_key = ?').get(key);
  if (cached) {
    logger.info('analysis cache hit');
    return { analysis: JSON.parse(cached.product_json), warnings };
  }

  const text = `Product title: ${product.title || '(none)'}\nDescription: ${product.description || '(none)'}\n\n` +
    (product.image ? 'Analyse the attached product image.' : 'No image is available, so infer from text only and mark visual fields "unknown".');

  let analysis;
  for (let attempt = 1; attempt <= 2 && !analysis; attempt++) {
    try {
      const raw = await askVision({ system: SYSTEM, images: product.image ? [product.image] : [], text });
      analysis = normalize(analysisSchema.parse(extractJson(raw)));
    } catch (e) {
      logger.warn({ err: e.message, attempt }, 'image brain attempt failed');
    }
  }

  if (!analysis) {
    warnings.push('Image analysis failed, so a text-only query was used. Match scores may be less accurate.');
    return { analysis: fallbackAnalysis(product.title || 'product'), warnings }; // not cached
  }

  db.prepare('INSERT OR REPLACE INTO product_cache VALUES (?, ?, ?)').run(key, JSON.stringify(analysis), Date.now());
  return { analysis, warnings };
}