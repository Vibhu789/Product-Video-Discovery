import { EventEmitter } from 'node:events';

const MAX_EVENTS = 400;
const KEEP_AFTER_DONE_MS = 30 * 60_000;
const channels = new Map();

export function ensureChannel(id) {
  if (!channels.has(id)) {
    const em = new EventEmitter();
    em.setMaxListeners(100);
    channels.set(id, { events: [], em, done: false, seq: 0 });
  }
  return channels.get(id);
}

export function publish(id, evt) {
  const ch = ensureChannel(id);
  const e = { ...evt, seq: ch.seq++, ts: Date.now() };
  ch.events.push(e);
  if (ch.events.length > MAX_EVENTS) ch.events.shift();
  ch.em.emit('event', e);
  if (e.type === 'done' || e.type === 'error') {
    ch.done = true;
    setTimeout(() => channels.delete(id), KEEP_AFTER_DONE_MS).unref();
  }
}

/** Replays history, then streams live. Returns null when no channel exists (finished long ago, or unknown). */
export function subscribe(id, send) {
  const ch = channels.get(id);
  if (!ch) return null;
  for (const e of ch.events) send(e);
  if (ch.done) return { done: true, unsubscribe() {} };
  ch.em.on('event', send);
  return { done: false, unsubscribe: () => ch.em.off('event', send) };
}