export default function ErrorBox({ error }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1">{error.message}</p>
      {error.hint && <p className="mt-1 text-rose-700">{error.hint}</p>}
    </div>
  );
}