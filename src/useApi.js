import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from './ui/Toast.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  One way to load data
//
//  Every page needs the same four things: the data, "it is still loading",
//  the error, and "fetch it again". Written separately on each page, one of
//  them ends up stuck loading forever and another swallows its error.
//
//  One detail matters: if the user has moved on, a late response from the
//  previous request must not land in state. Otherwise you are on a different
//  page and the old page's data flashes into it.
// ─────────────────────────────────────────────────────────────────────────────

export function useApi(fn, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const { showError } = useToast();

  // Each call gets a number — only the newest answer is accepted
  const seq = useRef(0);

  const run = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fn();
      if (mine !== seq.current) return;      // a newer call started meanwhile
      setData(res);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err);
      showError(err);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (skip) { setLoading(false); return; }
    run();
    return () => { seq.current++; };        // leaving the page voids the answer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, skip]);

  return { data, loading, error, reload: run, setData };
}

/**
 * A small way to read and write the URL's query params.
 *
 *  Keeping filters in the URL means a screen can be shared and survives a
 *  refresh — the same as the panel did before.
 */
export function useQueryState(searchParams, setSearchParams) {
  const get = useCallback(
    (key, fallback = '') => searchParams.get(key) ?? fallback,
    [searchParams]
  );
  const patch = useCallback(
    (changes, { replace = false } = {}) => {
      const next = new URLSearchParams(searchParams);
      for (const [k, v] of Object.entries(changes)) {
        if (v === '' || v === null || v === undefined) next.delete(k);
        else next.set(k, String(v));
      }
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams]
  );
  return { get, patch };
}
