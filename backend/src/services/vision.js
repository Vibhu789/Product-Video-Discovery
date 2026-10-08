import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';

let client;
function getClient() {
  if (!config.anthropicKey) {
    const err = new Error('ANTHROPIC_API_KEY is not set');
    err.status = 503;
    throw err;
  }
  client ??= new Anthropic({ apiKey: config.anthropicKey, maxRetries: 2, timeout: 45_000 });
  return client;
}

async function askAnthropic({ system, images, text, maxTokens }) {
  const content = [
    ...images.flatMap((img, i) => [
      { type: 'text', text: `Image ${i + 1}:` },
      { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } },
    ]),
    { type: 'text', text },
  ];
  const res = await getClient().messages.create({
    model: config.visionModel,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content }],
  });
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function askGemini({ system, images, text, maxTokens }) {
  if (!config.geminiKey) {
    const err = new Error('GEMINI_API_KEY is not set');
    err.status = 503;
    throw err;
  }
  const parts = [
    ...images.flatMap((img, i) => [
      { text: `Image ${i + 1}:` },
      { inline_data: { mime_type: img.mediaType, data: img.base64 } },
    ]),
    { text },
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': config.geminiKey },
      signal: AbortSignal.timeout(60_000),
      body,
    });

    if (res.ok) {
      const data = await res.json();
      return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    }

    const errText = await res.text();
    if (res.status === 429) {
      const dailyQuota = /PerDay/i.test(errText); // waiting will not help until tomorrow
      if (dailyQuota || attempt === 3) {
        const err = new Error(dailyQuota ? 'Gemini daily quota used up' : 'Gemini rate limit reached');
        err.fatal = dailyQuota;
        throw err;
      }
      const m = errText.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
      const waitMs = Math.min(60_000, (m ? Number(m[1]) : 20) * 1000 + 500);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`);
  }
}

/** images: [{ mediaType, base64 }] -> model's text reply */
export async function askVision({ system, images = [], text, maxTokens = 1200 }) {
  const args = { system, images, text, maxTokens };
  return config.visionProvider === 'gemini' ? askGemini(args) : askAnthropic(args);
}

/** Pull the first JSON object out of a model reply, tolerating code fences. */
export function extractJson(raw) {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object in model reply');
  return JSON.parse(cleaned.slice(start, end + 1));
}