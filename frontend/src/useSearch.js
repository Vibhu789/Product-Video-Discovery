import { useCallback, useEffect, useRef, useState } from 'react';
import { startSearch, getSearch, getHistory, openEvents } from './api';

const EMPTY = { stages: {}, counts: {}, progress: {}, warnings: [], product: null };

export function useSearch() {
  const [phase, setPhase] = useState('idle'); // idle | running | done | failed
  const [live, setLive] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const closeRef = useRef(() => {});

  const refreshHistory = useCallback(
    () => getHistory().then((d) => setHistory(d.searches)).catch(() => {}),
    [],
  );

  useEffect(() => {
    refreshHistory();
    return () => closeRef.current();
  }, [refreshHistory]);

  const loadResult = useCallback(async (id) => {
    try {
      const s = await getSearch(id);
      setResult(s);
      if (s.status === 'failed') {
        setError({ message: s.error || 'The search failed', hint: 'Try again with a different input.' });
        setPhase('failed');
      } else {
        setPhase('done');
      }
    } catch (e) {
      setError({ message: e.message });
      setPhase('failed');
    }
    refreshHistory();
  }, [refreshHistory]);

  const attach = useCallback((id) => {
    closeRef.current();
    const handle = (e) => {
      switch (e.type) {
        case 'stage':
          setLive((l) => {
            const prev = l.stages[e.stage] || {};
            return {
              ...l,
              stages: { ...l.stages, [e.stage]: { status: e.status, label: e.label ?? prev.label, round: e.round ?? prev.round } },
            };
          });
          break;
        case 'product': setLive((l) => ({ ...l, product: e.product })); break;
        case 'progress': setLive((l) => ({ ...l, progress: { ...l.progress, [e.source]: e } })); break;
        case 'counts': setLive((l) => ({ ...l, counts: { ...l.counts, [e.source]: e } })); break;
        case 'warning': setLive((l) => ({ ...l, warnings: [...l.warnings, e.message] })); break;
        case 'done':
          closeRef.current();
          loadResult(id);
          break;
        case 'error':
          closeRef.current();
          setError({ message: e.message, hint: e.hint });
          setPhase('failed');
          refreshHistory();
          break;
        default: break;
      }
    };
    closeRef.current = openEvents(id, { onEvent: handle, onClosed: () => loadResult(id) });
  }, [loadResult, refreshHistory]);

  const run = useCallback(async (payload) => {
    closeRef.current();
    setError(null);
    setResult(null);
    setLive(EMPTY);
    setPhase('running');
    try {
      const { id } = await startSearch(payload);
      attach(id);
    } catch (e) {
      setError({ message: e.message, hint: e.details?.join(' ') });
      setPhase('failed');
    }
  }, [attach]);

  const openPast = useCallback(async (id) => {
    closeRef.current();
    setError(null);
    setResult(null);
    setLive(EMPTY);
    try {
      const s = await getSearch(id);
      if (s.status === 'queued' || s.status === 'running') {
        setPhase('running');
        attach(id);
        return;
      }
      setResult(s);
      if (s.status === 'failed') {
        setError({ message: s.error || 'The search failed', hint: 'Start a new search.' });
        setPhase('failed');
      } else {
        setPhase('done');
      }
    } catch (e) {
      setError({ message: e.message });
      setPhase('failed');
    }
  }, [attach]);

  return { phase, live, result, error, history, run, openPast };
}