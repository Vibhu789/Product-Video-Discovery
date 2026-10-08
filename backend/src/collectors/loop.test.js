import { describe, it, expect } from 'vitest';
import { collectUntil } from './loop.js';
import { FatalSourceError } from '../lib/retry.js';

const vid = (k) => ({ platform: 'instagram', videoKey: k, url: `https://x/${k}` });

describe('collectUntil', () => {
  it('stops as soon as the target is met', async () => {
    let calls = 0;
    const r = await collectUntil({
      platform: 'instagram', terms: ['a', 'b', 'c'], need: 3,
      fetchTerm: async () => { calls++; return [vid('1'), vid('2'), vid('3')]; },
    });
    expect(r.videos).toHaveLength(3);
    expect(calls).toBe(1);
  });

  it('expands to later terms and removes duplicates', async () => {
    const pages = { a: [vid('1'), vid('2')], b: [vid('2'), vid('3')] };
    const r = await collectUntil({
      platform: 'instagram', terms: ['a', 'b'], need: 3, fetchTerm: async (t) => pages[t],
    });
    expect(r.videos.map((v) => v.videoKey)).toEqual(['1', '2', '3']);
    expect(r.shortfall).toBe(0);
  });

  it('respects the accept filter and reports a shortfall', async () => {
    const r = await collectUntil({
      platform: 'instagram', terms: ['a'], need: 3,
      fetchTerm: async () => [vid('1'), vid('2')], accept: (v) => v.videoKey !== '1',
    });
    expect(r.videos).toHaveLength(1);
    expect(r.shortfall).toBe(2);
  });

  it('stops on a fatal error but keeps what it has', async () => {
    let n = 0;
    const r = await collectUntil({
      platform: 'meta', terms: ['a', 'b'], need: 5,
      fetchTerm: async () => { if (n++ === 0) return [vid('1')]; throw new FatalSourceError('no credits'); },
    });
    expect(r.videos).toHaveLength(1);
    expect(r.error).toBe('no credits');
  });
});