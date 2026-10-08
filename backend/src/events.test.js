import { describe, it, expect } from 'vitest';
import { ensureChannel, publish, subscribe } from './events.js';

describe('events', () => {
  it('replays history to late subscribers and flags finished channels', () => {
    ensureChannel('t1');
    publish('t1', { type: 'stage', stage: 'x' });

    const got = [];
    const sub = subscribe('t1', (e) => got.push(e));
    expect(got).toHaveLength(1);
    expect(sub.done).toBe(false);

    publish('t1', { type: 'done' });
    expect(got.map((e) => e.type)).toEqual(['stage', 'done']);

    const late = [];
    expect(subscribe('t1', (e) => late.push(e)).done).toBe(true);
    expect(late).toHaveLength(2);
    sub.unsubscribe();
  });

  it('returns null for unknown searches', () => {
    expect(subscribe('nope', () => {})).toBeNull();
  });
});