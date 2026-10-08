import { useSearch } from './useSearch';
import SearchBar from './components/SearchBar';
import ProgressPanel from './components/ProgressPanel';
import ProductPanel from './components/ProductPanel';
import Results from './components/Results';
import History from './components/History';
import ErrorBox from './components/ErrorBox';

export default function App() {
  const s = useSearch();
  const product = s.result?.product ?? s.live.product;
  const running = s.phase === 'running';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <h1 className="text-lg font-semibold">Product Video Discovery</h1>
          <p className="text-xs text-slate-500">Instagram Reels and Meta Ad Library videos that show your exact product</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-4 md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside>
          <History items={s.history} activeId={s.result?.id} onOpen={s.openPast} />
        </aside>
        <main className="min-w-0 space-y-6">
          <SearchBar onSubmit={s.run} busy={running} />
          {s.error && <ErrorBox error={s.error} />}
          {running && <ProgressPanel live={s.live} />}
          {product && <ProductPanel product={product} />}
          {s.result && !running && s.result.status === 'done' && <Results result={s.result} />}
          {s.phase === 'idle' && (
            <p className="py-10 text-center text-sm text-slate-500">
              Enter a product name or paste a product link to start.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}