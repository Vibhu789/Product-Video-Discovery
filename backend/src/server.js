// import express from 'express';
// import cors from 'cors';
// import pinoHttp from 'pino-http';
// import { config } from './config.js';
// import { logger } from './logger.js';
// import './db.js';

// const app = express();
// app.use(cors());
// app.use(express.json({ limit: '8mb' })); // room for base64 image uploads
// app.use(pinoHttp({ logger }));

// app.get('/api/health', (_req, res) => res.json({ ok: true }));

// // routes get mounted here in Step 7

// app.use((err, _req, res, _next) => {
//   logger.error({ err }, 'unhandled');
//   res.status(err.status || 500).json({ error: err.message || 'Internal error' });
// });

// app.listen(config.port, () => logger.info(`API on :${config.port}`));

import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { logger } from './logger.js';
import { db } from './db.js';
import { router } from './routes/search.js';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || true })); // set CORS_ORIGIN in production
app.use(express.json({ limit: '8mb' })); // room for a base64 image upload
app.use(pinoHttp({ logger }));

// Searches that were queued or running when the server last stopped will never finish.
const stuck = db.prepare(
  "UPDATE searches SET status = 'failed', error = 'The server restarted while this search was running' WHERE status IN ('queued', 'running')",
).run();
if (stuck.changes) logger.warn({ count: stuck.changes }, 'marked interrupted searches as failed');

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', router);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) logger.error({ err }, 'unhandled error');
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));

app.listen(config.port, () => logger.info(`API listening on :${config.port}`));