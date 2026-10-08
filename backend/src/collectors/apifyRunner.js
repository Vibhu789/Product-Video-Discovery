import { ApifyClient } from 'apify-client';
import { config } from '../config.js';
import { FatalSourceError } from '../lib/retry.js';
import { logger } from '../logger.js';

export async function runActor(actorId, input, { limit = 50, timeoutSecs = 120 } = {}) {
  if (!config.apifyToken) throw new FatalSourceError('APIFY_TOKEN is not set');
  if (!actorId) throw new FatalSourceError('Actor ID is not configured for this source');

  const client = new ApifyClient({ token: config.apifyToken });
  try {
    const run = await client.actor(actorId).call(input, { timeout: timeoutSecs, waitSecs: timeoutSecs });
    if (run.status !== 'SUCCEEDED') throw new Error(`Actor run ended with status ${run.status}`);
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit });
    return items;
  } catch (e) {
    logger.warn({ actorId, status: e.statusCode, msg: e.message }, 'apify run failed');
    // 401/402/403 = bad token, no credits, or no access. Retrying will not help.
    if ([400, 401, 402, 403, 404].includes(e.statusCode)) {
      throw new FatalSourceError(`Apify refused the request (${e.statusCode}): ${e.message}`);
    }
    throw e; // 429 and network errors are retried by withRetry
  }
}

// .call(input, { timeout: timeoutSecs, waitSecs: timeoutSecs, log: null })