async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new Error('Cannot reach the server. Is the backend running on port 4000?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.details = data.details;
    throw err;
  }
  return data;
}

export const startSearch = (payload) =>
  request('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

export const getSearch = (id) => request(`/api/search/${id}`);
export const getHistory = () => request('/api/history');

/** Returns a close() function. onClosed fires only if the stream died before a terminal event. */
export function openEvents(id, { onEvent, onClosed }) {
  const es = new EventSource(`/api/search/${id}/events`);
  es.onmessage = (m) => {
    try { onEvent(JSON.parse(m.data)); } catch { /* ignore malformed frame */ }
  };
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) onClosed?.();
  };
  return () => es.close();
}