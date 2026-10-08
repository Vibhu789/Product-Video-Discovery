import { useMemo, useState } from 'react';
import VideoCard from './VideoCard';

const TABS = [['all', 'All'], ['instagram', 'Instagram Reels'], ['meta', 'Meta Ad Library']];
const LABEL = { instagram: 'Instagram Reels', meta: 'Meta Ad Library' };

export default function Results({ result }) {
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('score');
  const [minScore, setMinScore] = useState(0);
  const [showBelow, setShowBelow] = useState(false);
  const { videos, threshold, target, summary } = result;

  const countWhere = (platform, fn) =>
    videos.filter((v) => (!platform || v.platform === platform) && fn(v)).length;
  // "usable" = scored AND at or above the threshold; unscored videos never count toward the target
  const usableCount = (platform) => countWhere(platform, (v) => !v.belowThreshold && !v.unscored);
  const unscoredCount = (platform) => countWhere(platform, (v) => v.unscored);
  const belowCount = videos.filter((v) => v.belowThreshold).length;

  const list = useMemo(() => {
    return videos
      .filter((v) => tab === 'all' || v.platform === tab)
      .filter((v) => showBelow || !v.belowThreshold)
      .filter((v) => v.score === null || v.score >= minScore)
      .sort((a, b) =>
        sort === 'newest' ? (b.postedAt ?? 0) - (a.postedAt ?? 0) : (b.score ?? -1) - (a.score ?? -1),
      );
  }, [videos, tab, sort, minScore, showBelow]);

  const sourcesShown = tab === 'all' ? ['instagram', 'meta'] : [tab];
  const banners = sourcesShown.map((s) => ({ s, info: summary?.[s] })).filter((x) => x.info);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(([key, label]) => {
          const platform = key === 'all' ? null : key;
          const n = usableCount(platform);
          const u = unscoredCount(platform);
          const ok = key === 'all' || n >= target;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full border px-4 py-1.5 text-sm ${tab === key ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {label}{' '}
              <span className={`tabular-nums ${tab === key ? 'text-indigo-100' : ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                {key === 'all' ? n : `${n}/${target}`}
              </span>
              {u > 0 && (
                <span className={`ml-1 text-xs ${tab === key ? 'text-indigo-200' : 'text-slate-400'}`}>
                  +{u} unscored
                </span>
              )}
            </button>
          );
        })}
      </div>

      {banners.map(({ s, info }) =>
        info.shortfall > 0 || info.error || info.unscored > 0 ? (
          <div key={s} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">
              {LABEL[s]}: found {info.usable} of {target} matching videos
              {info.searches ? ` after ${info.searches} searches` : ''}.
            </p>
            {info.unscored > 0 && (
              <p className="mt-1 text-xs">{info.unscored} videos could not be scored, so their ranking is unreliable. The reason is shown on each card.</p>
            )}
            {info.filtered?.alreadySeen > 0 && (
              <p className="mt-1 text-xs">{info.filtered.alreadySeen} videos were skipped because you saw them in earlier searches.</p>
            )}
            {info.error && <p className="mt-1 text-xs">Source problem: {info.error}</p>}
            {info.notes?.slice(0, 3).map((n, i) => <p key={i} className="mt-1 text-xs">• {n}</p>)}
            <p className="mt-1 text-xs">Try a more specific name, upload the product image, or tick “Include previously seen videos”.</p>
          </div>
        ) : null,
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-white p-3 text-sm shadow-sm">
        <label className="flex items-center gap-2">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
            <option value="score">Best match</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Min match {minScore}%
          <input type="range" min="0" max="100" step="5" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showBelow} onChange={(e) => setShowBelow(e.target.checked)} />
          Show low matches ({belowCount}, below {threshold}%)
        </label>
        <span className="ml-auto text-xs text-slate-500">{list.length} shown</span>
      </div>

      {videos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          <p className="font-medium text-slate-800">No videos found for this product.</p>
          <p className="mt-1">Try a shorter or more specific name, upload a clear product photo, or include previously seen videos.</p>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          <p>No videos match the current filters.</p>
          <button onClick={() => { setMinScore(0); setShowBelow(true); setTab('all'); }} className="mt-2 text-indigo-600 hover:underline">
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((v) => <VideoCard key={v.id} video={v} threshold={threshold} />)}
        </div>
      )}
    </section>
  );
}