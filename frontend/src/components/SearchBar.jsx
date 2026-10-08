import { useRef, useState } from 'react';

function resizeToDataUrl(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; // avoid black backgrounds for transparent PNGs
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

export default function SearchBar({ onSubmit, busy }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [includeSeen, setIncludeSeen] = useState(false);
  const [localError, setLocalError] = useState('');
  const fileRef = useRef(null);
  const canSubmit = !busy && (text.trim() || image);

  async function pickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Please choose an image file.');
      return;
    }
    try {
      setImage(await resizeToDataUrl(file));
      setLocalError('');
    } catch {
      setLocalError('Could not read that image.');
    }
  }

  function clearImage() {
    setImage(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function submit(ev) {
    ev.preventDefault();
    const t = text.trim();
    const payload = { includeSeen };
    if (/^https?:\/\//i.test(t)) payload.url = t;
    else if (t) payload.query = t;
    if (image) payload.imageDataUrl = image;
    onSubmit(payload);
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Product name or product link (Shopify, Amazon, brand site…)"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? 'Searching…' : 'Find videos'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
        <label className="cursor-pointer text-indigo-600 hover:underline">
          Upload product image
          <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} className="hidden" />
        </label>
        {image && (
          <span className="flex items-center gap-2">
            <img src={image} alt="Selected product" className="h-8 w-8 rounded object-cover" />
            <button type="button" onClick={clearImage} className="text-xs text-slate-500 hover:text-rose-600">Remove</button>
          </span>
        )}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeSeen} onChange={(e) => setIncludeSeen(e.target.checked)} />
          Include previously seen videos
        </label>
      </div>
      {localError && <p className="mt-2 text-sm text-rose-600">{localError}</p>}
    </form>
  );
}