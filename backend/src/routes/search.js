import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { searchSchema } from '../validate.js';
import { assertSafeUrl } from '../lib/urlGuard.js';
import { createSearch, getSearch, getSearchStatus, listHistory, getThumbBlob } from '../repo.js';
import { ensureChannel, publish, subscribe } from '../events.js';
import { enqueueSearch, queueLoad } from '../queue.js';
import { runSearch } from '../pipeline.js';
import { logger } from '../logger.js';

export const router = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const UUID = /^[0-9a-f-]{36}$/i;
const isTerminal = (e) => e.type === 'done' || e.type === 'error';

const createLimiter = rateLimit({
  windowMs: 60_000, limit: 6, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many searches. Please wait a minute and try again.' },
});

router.post('/search', createLimiter, ah(async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues.map((i) => i.message) });
  }
  const input = parsed.data;
  if (input.url) await assertSafeUrl(input.url); // fail fast with a 400 before anything is queued
  if (queueLoad() >= 20) return res.status(503).json({ error: 'The server is busy. Please try again shortly.' });

  const id = crypto.randomUUID();
  createSearch({
    id,
    inputType: input.url ? 'url' : input.query ? 'keyword' : 'image',
    input: input.url || input.query || '(uploaded image)',
    options: { includeSeen: input.includeSeen, tiktok: input.tiktok },
  });
  ensureChannel(id);
  const emit = (e) => publish(id, e);
  emit({ type: 'stage', stage: 'queued', status: 'running', label: 'Queued' });

  enqueueSearch(() => runSearch({ searchId: id, input, emit }))
    .catch((err) => logger.error({ err: err.message, id }, 'queue task crashed'));

  res.status(202).json({ id, status: 'queued', eventsUrl: `/api/search/${id}/events`, resultUrl: `/api/search/${id}` });
}));

router.get('/search/:id', ah(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const s = getSearch(req.params.id);
  if (!s) return res.status(404).json({ error: 'Search not found' });
  res.json(s);
}));

router.get('/history', ah(async (_req, res) => res.json({ searches: listHistory() })));

router.get('/video/:id/thumb', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const blob = getThumbBlob(id);
  if (!blob) return res.status(404).json({ error: 'No thumbnail stored' });
  res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' }).send(blob);
}));

router.get('/search/:id/events', (req, res) => {
  const { id } = req.params;
  if (!UUID.test(id)) return res.status(400).json({ error: 'Invalid id' });
  const row = getSearchStatus(id);
  if (!row) return res.status(404).json({ error: 'Search not found' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
  });

  let ended = false;
  let hb;
  let sub;
  const finish = () => { if (ended) return; ended = true; clearInterval(hb); sub?.unsubscribe(); res.end(); };
  const send = (e) => {
    if (ended) return;
    res.write(`data: ${JSON.stringify(e)}\n\n`);
    if (isTerminal(e)) finish();
  };

  sub = subscribe(id, send);
  if (ended) return;
  if (!sub) {
    // No live channel (finished a while ago): answer from the database instead.
    if (row.status === 'done') send({ type: 'done', summary: row.summary });
    else send({ type: 'error', message: row.error || 'This search is no longer running', hint: 'Start a new search.' });
    return;
  }
  hb = setInterval(() => res.write(': ping\n\n'), 15_000);
  req.on('close', finish);
});