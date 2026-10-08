const STEPS = [
  ['fetch_page', 'Fetching product page'],
  ['analyse_image', 'Analysing product image'],
  ['search_instagram', 'Searching Instagram Reels'],
  ['search_meta', 'Searching Meta Ad Library'],
  ['score_instagram', 'Scoring Instagram matches'],
  ['score_meta', 'Scoring Meta matches'],
  ['finalize', 'Saving results'],
];

const SOURCES = [['instagram', 'Instagram Reels'], ['meta', 'Meta Ad Library']];

function Icon({ status }) {
  if (status === 'running') {
    return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />;
  }
  if (status === 'done') return <span className="text-emerald-600">✓</span>;
  return <span className="text-slate-300">○</span>;
}

export default function ProgressPanel({ live }) {
  const waiting = live.stages.queued && !live.stages.fetch_page;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Working on it…</h2>
      {waiting && <p className="mb-2 text-sm text-slate-500">Waiting in the queue…</p>}

      <ol className="space-y-1.5 text-sm">
        {STEPS.map(([key, label]) => {
          const st = live.stages[key];
          return (
            <li key={key} className={`flex items-center gap-2 ${st?.status ? 'text-slate-800' : 'text-slate-400'}`}>
              <Icon status={st?.status} />
              {label}
              {st?.round > 1 && st.status === 'running' && <span className="text-xs text-slate-500">(round {st.round}, widening the search)</span>}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SOURCES.map(([key, label]) => {
          const c = live.counts[key];
          const p = live.progress[key];
          const target = c?.target ?? 20;
          const usable = c?.usable ?? 0;
          return (
            <div key={key} className="rounded-lg bg-slate-50 p-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums text-slate-600">{usable} / {target}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, (usable / target) * 100)}%` }} />
              </div>
              {p && <p className="mt-2 truncate text-xs text-slate-500">Trying “{p.term}”</p>}
            </div>
          );
        })}
      </div>

      {live.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-700">
          {live.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
        </ul>
      )}
    </section>
  );
}