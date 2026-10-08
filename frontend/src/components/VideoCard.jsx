import { useState } from 'react';

const safeHref = (u) => (/^https:\/\//.test(u || '') ? u : null);

function scoreStyle(video, threshold) {
  if (video.unscored) return 'bg-slate-100 text-slate-600';
  if (video.score >= 80) return 'bg-emerald-100 text-emerald-800';
  if (video.score >= threshold) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-700';
}

export default function VideoCard({ video, threshold }) {
  const [imgFailed, setImgFailed] = useState(false);
  const href = safeHref(video.url);
  const isIg = video.platform === 'instagram';
  const date = video.postedAt
    ? new Date(video.postedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <article className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${video.belowThreshold ? 'border-dashed border-slate-300 opacity-70' : 'border-slate-200'}`}>
      <a href={href || undefined} target="_blank" rel="noopener noreferrer" className="relative block aspect-[4/5] bg-slate-100">
        {video.thumbnail && !imgFailed ? (
          <img src={video.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgFailed(true)} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">No preview available</div>
        )}
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${isIg ? 'bg-pink-100 text-pink-800' : 'bg-sky-100 text-sky-800'}`}>
          {isIg ? 'Instagram Reel' : 'Meta Ad'}
        </span>
        <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreStyle(video, threshold)}`}>
          {video.unscored ? 'Not scored' : `${video.score}% match`}
        </span>
      </a>

      <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
        <p className="text-slate-800">
          {video.reason}
          {video.belowThreshold && <span className="ml-1 text-xs text-rose-600">(below match threshold)</span>}
        </p>
        {video.caption && <p className="line-clamp-3 text-xs text-slate-500">{video.caption}</p>}
        <div className="mt-auto flex items-center justify-between pt-1 text-xs text-slate-500">
          <span>{date}</span>
          {href && <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 hover:underline">Open original ↗</a>}
        </div>
      </div>
    </article>
  );
}