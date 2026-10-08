import { describe, it, expect } from 'vitest';
import { Deduper } from './deduper.js';
import { mediaKey, captionFingerprint } from './keys.js';
import { hamming } from './phash.js';

const vid = (o) => ({ platform: 'instagram', videoKey: 'a', url: 'https://x/a', ...o });
const longCaption = 'Oversized graphic tee drop. Heavyweight cotton, relaxed fit, limited run, shop today';

describe('keys', () => {
  it('mediaKey ignores host and signed query', () => {
    expect(mediaKey('https://cdn1.fb.net/o1/v/t2/abc123456789.mp4?oe=1&sig=x'))
      .toBe(mediaKey('https://cdn9.fb.net/o1/v/t2/abc123456789.mp4?oe=2&sig=y'));
  });
  it('captionFingerprint ignores hashtags, links and spacing; skips short text', () => {
    const a = captionFingerprint(longCaption + ' #tee https://a.co/1');
    const b = captionFingerprint(longCaption.toUpperCase() + '   #other');
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(captionFingerprint('nice tee #tee')).toBeNull();
  });
});

describe('hamming', () => {
  it('counts differing bits', () => {
    expect(hamming('0000000000000000', '0000000000000000')).toBe(0);
    expect(hamming('0000000000000000', '000000000000000f')).toBe(4);
  });
});

describe('Deduper.accept', () => {
  it('blocks previously seen videos unless includeSeen', () => {
    const seen = new Set(['instagram:a']);
    expect(new Deduper({ seenKeys: seen }).accept(vid({}))).toBe(false);
    expect(new Deduper({ seenKeys: seen, includeSeen: true }).accept(vid({}))).toBe(true);
  });
  it('blocks same media file under a different ID', () => {
    const d = new Deduper();
    expect(d.accept(vid({ videoKey: '1', videoUrl: 'https://c1/v/file123456789.mp4?x=1' }))).toBe(true);
    expect(d.accept(vid({ videoKey: '2', videoUrl: 'https://c2/v/file123456789.mp4?x=2' }))).toBe(false);
  });
  it('blocks reposted captions on the same platform only', () => {
    const d = new Deduper();
    expect(d.accept(vid({ videoKey: '1', caption: longCaption }))).toBe(true);
    expect(d.accept(vid({ videoKey: '2', caption: longCaption + ' #repost' }))).toBe(false);
    expect(d.accept(vid({ videoKey: '3', platform: 'meta', caption: longCaption }))).toBe(true);
  });
  it('blocks the same Meta ad running under several IDs', () => {
    const d = new Deduper();
    expect(d.accept(vid({ platform: 'meta', videoKey: '1', groupKey: 'g1' }))).toBe(true);
    expect(d.accept(vid({ platform: 'meta', videoKey: '2', groupKey: 'g1' }))).toBe(false);
  });
});

describe('Deduper.refine', () => {
  const hashFn = async (v) => v.h ?? null;

  it('drops visual near-duplicates inside one search, keeps distinct ones', async () => {
    const d = new Deduper({ hashFn });
    const { kept, dropped } = await d.refine([
      vid({ videoKey: '1', h: 'ff00ff00ff00ff00' }),
      vid({ videoKey: '2', h: 'ff00ff00ff00ff01' }), // 1 bit away
      vid({ videoKey: '3', h: '00ff00ff00ff00ff' }),
    ]);
    expect(kept.map((v) => v.videoKey)).toEqual(['1', '3']);
    expect(dropped).toHaveLength(1);
  });

  it('drops near-duplicates of earlier searches unless includeSeen', async () => {
    const history = ['aaaaaaaaaaaaaaaa'];
    const list = () => [vid({ videoKey: '9', h: 'aaaaaaaaaaaaaaab' })];
    expect((await new Deduper({ hashFn, historyHashes: history }).refine(list())).kept).toHaveLength(0);
    expect((await new Deduper({ hashFn, historyHashes: history, includeSeen: true }).refine(list())).kept).toHaveLength(1);
  });

  it('keeps videos whose thumbnail cannot be hashed', async () => {
    const d = new Deduper({ hashFn: async () => { throw new Error('403'); } });
    expect((await d.refine([vid({ videoKey: '1' })])).kept).toHaveLength(1);
  });
});