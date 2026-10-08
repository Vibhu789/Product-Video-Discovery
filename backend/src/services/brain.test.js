import { describe, it, expect } from 'vitest';
import { sanitizeHashtags, dedupeQueries, fallbackAnalysis } from './brain.js';
import { extractJson } from './vision.js';

describe('brain helpers', () => {
    it('cleans and dedupes hashtags', () => {
    // '#Oversized Tee' and 'oversizedtee' collapse into one, 'a' is too short, 'Y2K!' becomes 'y2k'
    expect(sanitizeHashtags(['#Oversized Tee', 'oversizedtee', 'a', 'Y2K!'])).toEqual(['oversizedtee', 'y2k']);
  });
  it('dedupes queries case-insensitively and strips #', () => {
    expect(dedupeQueries(['Graphic tee', 'graphic  tee', '#vintage tee'])).toEqual(['Graphic tee', 'vintage tee']);
  });
  it('builds a usable fallback from a title', () => {
    const a = fallbackAnalysis('Protein Dark Chocolate Bar');
    expect(a.queries.instagram.length).toBeGreaterThan(0);
    expect(a.hashtags.length).toBeGreaterThan(0);
  });
  it('extracts JSON from fenced replies', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});