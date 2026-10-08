import 'dotenv/config';

const key = process.env.GEMINI_API_KEY;
if (!key) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const SKIP = /(tts|robotics|computer-use|deep-research|antigravity|image|embedding|live|audio|veo|imagen|learnlm|gemma|aqa)/i;
// 1x1 PNG, only used to prove that the model accepts image input
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// 1) fetch every page of the model list
let all = [];
let pageToken = '';
do {
  const url = new URL(BASE);
  url.searchParams.set('pageSize', '50');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const res = await fetch(url, { headers: { 'x-goog-api-key': key } });
  const data = await res.json();
  if (!res.ok) { console.error(res.status, JSON.stringify(data).slice(0, 400)); process.exit(1); }
  all.push(...(data.models || []));
  pageToken = data.nextPageToken || '';
} while (pageToken);

const candidates = all
  .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
  .map((m) => m.name.replace('models/', ''))
  .filter((n) => n.startsWith('gemini') && !SKIP.test(n));

console.log(`Total models: ${all.length}. Text+image candidates: ${candidates.length}`);
console.log(candidates.join('\n'), '\n');

// 2) probe the most likely ones (flash first), max 8
const ordered = [...candidates.filter((n) => /flash/i.test(n)), ...candidates.filter((n) => !/flash/i.test(n))].slice(0, 8);

for (const name of ordered) {
  const res = await fetch(`${BASE}/${name}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }, { inline_data: { mime_type: 'image/png', data: PNG } }] }],
      generationConfig: { maxOutputTokens: 64 },
    }),
  });
  const verdict =
    res.status === 200 ? 'WORKS' :
    res.status === 429 ? 'name is valid but rate-limited right now' :
    `FAILED (${res.status})`;
  console.log(`${name.padEnd(40)} ${verdict}`);
}