# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.


# Product Video Discovery Dashboard

Type a product name, paste a product link, or upload a photo. The app studies the product, then finds short videos that show it: Instagram Reels and Meta Ad Library video ads. Every video gets a 0-100 match score with a one-line reason, and videos you've already seen in earlier searches don't come back unless you ask for them.

Built for the 24-hour assignment. It runs end to end on my machine; the rough edges are listed under.


## Setup and running

You need Node 20+ (I used 22), an [Apify](https://apify.com) account, and a Gemini API key (a Claude key works too).

```bash
# 1. backend
cd backend
npm install
cp .env.example .env      # fill in the keys, see below
npm run dev               # API on http://localhost:4000

# 2. frontend (new terminal)
cd frontend
npm install
npm run dev               # app on http://localhost:5173
```

Open http://localhost:5173, type a product name or paste a link, and press **Find videos**. You'll see each step of the pipeline tick off and two progress bars (Instagram, Meta) filling toward 20. A search takes a few minutes, mostly waiting on the scrapers. Run it again on the same product to see new videos come back; tick "Include previously seen videos" if you want the old ones too.

**`backend/.env`**

| Variable | Purpose |
|---|---|
| `VISION_PROVIDER` | `gemini` or `anthropic` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini key and model name |
| `ANTHROPIC_API_KEY`, `VISION_MODEL` | Only if the provider is `anthropic` |
| `VISION_RPM` | Max vision requests per minute (keep under your plan's limit) |
| `APIFY_TOKEN` | Apify API token |
| `IG_ACTOR_ID` | Instagram actor: `apify/instagram-hashtag-scraper` |
| `META_ACTOR_ID` | Meta actor: `apify/facebook-ads-scraper` |
| `MATCH_THRESHOLD` | Below this score a video is marked a low match (default 55) |
| `MIN_PER_SOURCE` | Target per source (default 20) |

No secrets are committed; `.env` is git-ignored. Tests: `cd backend && npm test`.

## Architecture

```
search input (name / link / image)
        |
  product resolver      page fetch, title + description + main image
        |
  image brain           attributes, queries, hashtags
        |
   +----+-----+
Instagram   Meta        collected in parallel, each in its own loop
   +----+-----+
        |
  de-dup + scoring      history filter, near-duplicates, 0-100 + reason
        |
  SQLite  ->  REST + SSE API  ->  React dashboard
```

- **Backend:** Node.js and Express. A search is queued and run in the background (two at a time) by an in-process queue, and progress is streamed to the browser with Server-Sent Events.
- **Storage:** SQLite holds search history, the videos shown, a product/analysis cache and thumbnails.
- **Frontend:** React, Vite and Tailwind. Tabs per source with a live count against 20, filters, sorting, history.
- **API:** `POST /api/search`, `GET /api/search/:id`, `GET /api/search/:id/events` (SSE), `GET /api/history`.

Security basics: product URLs are checked before anything is fetched (http/https only, no credentials, and the hostname must not resolve to a private or internal address; redirects are re-checked at every hop). Input is validated, searches are rate limited, and all keys come from environment variables.

## How each video source is collected

Neither platform offers a simple public search API for this. Instagram has none, and the official Meta Ad Library API, as far as I could tell, is aimed at political and issue ads rather than general commercial video ads. So both sources use Apify scraping actors behind a small collector interface, which means the provider can be swapped without touching the rest.

- **Instagram Reels:** `apify/instagram-hashtag-scraper`, searched with hashtags the image brain generated. My first try, `apify/instagram-scraper` in search mode, returned almost nothing useful, so I switched. On Apify's free plan the hashtag actor returns one page per hashtag, so reaching 20 usually takes several hashtags.
- **Meta Ad Library:** `apify/facebook-ads-scraper`, given an Ad Library search URL already filtered to video ads. Facebook sometimes blocks a request mid-run; the actor retries on its own, which just makes some runs slower. Image-only ads are dropped.

**When things go wrong:** a failed search term is retried once; errors that retrying can't fix (bad input, bad token, no credits) stop that source immediately. Runs and rounds have timeouts. The two sources are independent, so one failing never stops the other. If a source ends up under 20 good videos, it widens the search with broader terms for up to three rounds, and if it's still short, the page says how many it found, how many searches that took, and why, instead of failing silently.

## How the image brain works

1. **Analyse the product.** One vision call returns structured JSON: product type, colours, prints, logos, text on the product, material, shape, and a few "distinguishing features". It also writes search queries and hashtags per platform, plus broader fallback queries. The reply is validated, retried once if malformed, and cached, so the same product costs no second call. If the model is down it falls back to a text-only analysis and shows a warning.
2. **Score each video.** The product photo and a few candidate cover frames (with their captions) go into one request. The model returns a score and a reason per video: 90-100 exact product clearly visible, 70-89 very close, 40-69 same category but different design, 0-39 different product or not visible. The picture outranks the caption, and a caption alone can't push a score above 69. Captions are treated as untrusted text.
3. **Apply the threshold.** Videos under `MATCH_THRESHOLD` are kept but marked as low matches and hidden by default. Videos that couldn't be scored are shown as "Not scored" with the reason and don't count toward the 20.

I used a vision-language model instead of plain embeddings because I wanted every score to come with a reason a person can check ("same black tee with the caterpillar print, worn by a model").

## De-duplication strategy

Each video shown is saved with its platform ID and the search that returned it. Later searches filter against that history, cheapest check first:

1. **Seen before:** same platform and ID as a scored video from an earlier search.
2. **Same media file:** different IDs, same video. Compared by the file path of the media URL, ignoring the CDN host and signed query string.
3. **Same caption:** lowercased, with links, hashtags and punctuation removed; if at least 40 characters remain, it's hashed and compared within the platform. Catches reposts.
4. **Same Meta ad:** Meta's collation ID groups one ad running under several IDs; I keep one.
5. **Near-duplicate cover frame:** a 64-bit perceptual hash (dHash) of the thumbnail; two hashes within 6 bits are treated as the same video, inside a search and against history.

If de-dup leaves a source short, the collector moves on to the next search terms until the target is met or the terms run out.

## Known limitations

- **Scoring only sees the cover frame.** If the product shows up later in the video, a good match can score low.
- **Instagram hashtags are noisy.** Unrelated reels carry popular hashtags; that's why scoring matters, and why Instagram sometimes needs several rounds.
- **Meta search is keyword-based.** With no brand or model in the product title, queries get generic and results drift, so Meta can end up under 20.
- **Free-tier quotas are the real ceiling** (Apify credits, Gemini per-minute and daily limits). The app paces requests and reports "scoring unavailable" clearly, but can't create capacity.
- **Near-duplicates are judged on the cover frame only.** A re-upload with a different cover gets through, and the caption check can merge two different ads that share the same copy.
- **The job queue is in memory.** A restart mid-search loses that search (it's marked failed on the next start).
- **DNS rebinding:** the URL check resolves the hostname, then fetch resolves it again. Pinning the checked IP would close the gap.
- **No authentication.** It's a single-user tool. The threshold (55) and hash distance (6) were tuned on a handful of products only.

## What I'd build next

1. Score 3-4 sampled frames per video (ffmpeg) instead of just the cover.
2. Move the queue to Redis with BullMQ so searches survive restarts.
3. Add embedding similarity as a cheap pre-filter so the vision model only judges close candidates.
4. Build a small labelled set so the threshold can be tuned with numbers.
5. Add TikTok as an optional third source behind its own toggle, plus shortlist export and a Docker Compose setup. None of these are built yet.

## Test results
PVD: five products, with counts per source and a few good and bad matches._

Pass 36 case. 



