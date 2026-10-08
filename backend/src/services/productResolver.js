import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import { db } from '../db.js';
import { safeFetch } from '../lib/safeFetch.js';
import { logger } from '../logger.js';

const IMG_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function normalizeUrl(raw) {
  const u = new URL(raw);
  u.hash = '';
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
    .forEach((p) => u.searchParams.delete(p));
  return u.toString();
}

function firstImage(img) {
  if (!img) return null;
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return firstImage(img[0]);
  return img.url || null;
}

function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);
  let ld = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const nodes = Array.isArray(data) ? data : data['@graph'] || [data];
      const hit = nodes.find((n) => [].concat(n['@type'] || []).includes('Product'));
      if (hit && !ld) ld = hit;
    } catch { /* ignore malformed JSON-LD */ }
  });

  const meta = (name) =>
    $(`meta[property="${name}"]`).attr('content') || $(`meta[name="${name}"]`).attr('content');

  const title = ld?.name || meta('og:title') || $('title').first().text() || '';
  const description = ld?.description || meta('og:description') || meta('description') || '';
  const image = firstImage(ld?.image) || meta('og:image') || meta('twitter:image') || null;

  return {
    title: title.trim().slice(0, 300),
    description: description.trim().slice(0, 1500),
    imageUrl: image ? new URL(image, pageUrl).toString() : null,
  };
}

async function downloadImage(url) {
  const { body, contentType } = await safeFetch(url, { maxBytes: 5_000_000 });
  const mediaType = contentType.split(';')[0].trim().toLowerCase();
  if (!IMG_TYPES.includes(mediaType)) throw new Error(`Unsupported image type: ${mediaType}`);
  return { mediaType, base64: body.toString('base64') };
}

function parseDataUrl(dataUrl) {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  return { mediaType: m[1], base64: m[2] };
}

/**
 * Returns { title, description, sourceUrl, image: {mediaType, base64} | null, warnings: [] }
 */
export async function resolveProduct({ query, url, imageDataUrl }) {
  const warnings = [];
  let product = { title: query || '', description: '', sourceUrl: null, image: null };

  if (url) {
    const key = sha(normalizeUrl(url));
    const cached = db.prepare('SELECT product_json FROM product_cache WHERE cache_key = ?').get(key);

    if (cached) {
      logger.info({ url }, 'product cache hit');
      product = JSON.parse(cached.product_json);
    } else {
      try {
        const page = await safeFetch(url, { maxBytes: 3_000_000 });
        const parsed = parsePage(page.body.toString('utf8'), page.finalUrl);
        product = { ...parsed, sourceUrl: page.finalUrl, image: null };

        if (parsed.imageUrl) {
          product.image = await downloadImage(parsed.imageUrl).catch((e) => {
            warnings.push(`Could not download product image: ${e.message}`);
            return null;
          });
        } else {
          warnings.push('No product image found on the page');
        }

        // only cache usable results
        if (product.title) {
          db.prepare('INSERT OR REPLACE INTO product_cache VALUES (?, ?, ?)')
            .run(key, JSON.stringify(product), Date.now());
        }
      } catch (e) {
        if (e.upstreamStatus === 403 || e.upstreamStatus === 429) {
          warnings.push('The store blocked automated access. Try the product name or upload the image.');
        }
        if (!query && !imageDataUrl) throw e; // nothing else to fall back on
        warnings.push(`Product page failed: ${e.message}`);
      }
    }
  }

  if (query && !product.title) product.title = query;

  // An uploaded image always wins over the page image
  if (imageDataUrl) product.image = parseDataUrl(imageDataUrl);

  if (!product.title && !product.image) throw Object.assign(new Error('Could not determine the product'), { status: 422 });
  return { ...product, warnings };
}