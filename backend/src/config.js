import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  dbPath: process.env.DB_PATH || './data/app.db',
  minPerSource: Number(process.env.MIN_PER_SOURCE || 20),
  matchThreshold: Number(process.env.MATCH_THRESHOLD || 55),
  enableTikTok: process.env.ENABLE_TIKTOK === 'true',
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  visionModel: process.env.VISION_MODEL || 'claude-sonnet-4-6',
  visionProvider: process.env.VISION_PROVIDER || 'anthropic', // anthropic | gemini
  geminiKey: process.env.GEMINI_API_KEY,
  // geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash ',
  apifyToken: process.env.APIFY_TOKEN,
  igActor: process.env.IG_ACTOR_ID,
  metaActor: process.env.META_ACTOR_ID,
  visionRpm: Number(process.env.VISION_RPM || 8),
};