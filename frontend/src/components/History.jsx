const DOT = { done: 'bg-emerald-500', failed: 'bg-rose-500', running: 'bg-amber-400', queued: 'bg-amber-400' };

export default function History({ items, activeId, onOpen }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Search history</h2>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">Your earlier searches will appear here.</p>
      ) : (
        <ul className="max-h-[70vh] space-y-1 overflow-y-auto">
          {items.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onOpen(s.id)}
                className={`w-full rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${activeId === s.id ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[s.status] || 'bg-slate-300'}`} />
                  <span className="truncate text-sm">{s.title || s.input}</span>
                </div>
                <div className="ml-4 text-xs text-slate-500">
                  IG {s.counts.instagram} · Meta {s.counts.meta} · {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}