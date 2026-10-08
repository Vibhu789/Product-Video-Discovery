function Chips({ label, items }) {
  const list = (Array.isArray(items) ? items : [items]).filter((x) => x && x !== 'unknown');
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="w-24 shrink-0 text-slate-500">{label}</span>
      {list.map((x) => (
        <span key={x} className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">{x}</span>
      ))}
    </div>
  );
}

export default function ProductPanel({ product }) {
  const a = product.analysis;
  const href = /^https?:\/\//.test(product.sourceUrl || '') ? product.sourceUrl : null;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
      {product.previewDataUrl && (
        <img src={product.previewDataUrl} alt={product.title || 'Product'} className="h-40 w-40 shrink-0 rounded-lg bg-slate-100 object-contain" />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="text-base font-semibold">{product.title || 'Product from image'}</h2>
        {href && <a href={href} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-indigo-600 hover:underline">{href}</a>}
        {a && (
          <div className="space-y-1.5">
            <Chips label="Type" items={a.productType} />
            <Chips label="Colours" items={a.colors} />
            <Chips label="Prints" items={a.prints} />
            <Chips label="Logos" items={a.logos} />
            <Chips label="Text" items={a.textOnProduct} />
            <Chips label="Material" items={a.material} />
            <Chips label="Shape" items={a.shape} />
            <Chips label="Key features" items={a.distinguishing} />
            <Chips label="Hashtags" items={(a.hashtags || []).map((h) => `#${h}`)} />
          </div>
        )}
        {product.warnings?.length > 0 && (
          <ul className="text-xs text-amber-700">{product.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul>
        )}
      </div>
    </section>
  );
}