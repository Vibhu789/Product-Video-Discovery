export class FatalSourceError extends Error {
  constructor(msg) { super(msg); this.fatal = true; } // auth, credits, missing config: retrying is pointless
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withRetry(fn, { attempts = 2, baseMs = 1500 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (e.fatal || i === attempts) break;
      await sleep(baseMs * i);
    }
  }
  throw lastErr;
}

export function withTimeout(promise, ms, label = 'operation') {
  let t;
  const timeout = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timed out`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}