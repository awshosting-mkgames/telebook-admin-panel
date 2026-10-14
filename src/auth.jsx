import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, store, setSessionLostHandler } from './api.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Who is signed in — in one place.
//
//  Permissions come from here, so the menu and the pages work from the same
//  truth. The backend still checks every request on its own.
// ─────────────────────────────────────────────────────────────────────────────

const AuthCtx = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

/** Does this admin hold any of these permissions? */
export const useCan = () => {
  const { me } = useAuth();
  return useCallback(
    (...perms) => {
      const mine = me?.permissions || [];
      return perms.some((p) => mine.includes(p));
    },
    [me]
  );
};

export function AuthProvider({ children }) {
  const [me, setMe] = useState(store.me);
  // 'checking' = there is a token, but we are still verifying it
  const [state, setState] = useState(store.token ? 'checking' : 'out');
  const [notice, setNotice] = useState('');

  const signOut = useCallback((message = '') => {
    store.clear();
    setMe(null);
    setNotice(message);
    setState('out');
  }, []);

  // A 401 from anywhere lands here — one route back to the login screen
  useEffect(() => {
    setSessionLostHandler((msg) => signOut(msg));
  }, [signOut]);

  // On start: if a token is lying around, check it still works. This also
  // returns fresh permissions — with stale ones, a changed role would show
  // the wrong menu.
  useEffect(() => {
    if (state !== 'checking') return;
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/auth/me');
        if (!alive) return;
        store.me = res.data.admin;
        setMe(res.data.admin);
        setState('in');
      } catch (err) {
        if (!alive) return;
        // The 401 handler above covers that case; show login for the rest too
        signOut(err?.status === 401 ? '' : err?.message || '');
      }
    })();
    return () => { alive = false; };
  }, [state, signOut]);

  const signIn = useCallback(async ({ base, email, password }) => {
    // The base comes from .env; only remember it when typed by hand
    if (base && base !== store.base) store.base = base.replace(/\/$/, '');
    const res = await api.post('/auth/login', { email, password });
    store.token = res.data.token;
    store.me = res.data.admin;
    setMe(res.data.admin);
    setNotice('');
    setState('in');
    return res.data.admin;
  }, []);

  /** The admin object can change after a password change */
  const refresh = useCallback(async () => {
    const res = await api.get('/auth/me');
    store.me = res.data.admin;
    setMe(res.data.admin);
  }, []);

  return (
    <AuthCtx.Provider value={{ me, state, notice, signIn, signOut, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}
