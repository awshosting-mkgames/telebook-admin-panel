// ─────────────────────────────────────────────────────────────────────────────
//  The one place that talks to the backend.
//
//  Every page calls through here, so the token, error handling and the
//  "your session ended" behaviour all live in a single place.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_KEY  = 'tb_admin_base';
const TOKEN_KEY = 'tb_admin_token';
const ADMIN_KEY = 'tb_admin_me';

/**
 * Where the backend is.
 *
 *  This comes from VITE_API_BASE_URL in `.env`, which is why the login screen
 *  does not ask for it — an admin only types an email and a password, like
 *  any other panel.
 *
 *  Left empty, the panel asks the same origin it was served from (correct
 *  when the panel and the backend share a domain).
 *
 *  A value in localStorage wins over this. That only matters when the
 *  configured address turns out to be wrong: the login screen then offers a
 *  "server address" field and writes the corrected value there.
 */
export const DEFAULT_BASE =
  (import.meta.env?.VITE_API_BASE_URL || '').trim() || window.location.origin;

/**
 * The token lives in sessionStorage, NOT localStorage.
 *
 *  An admin token moves coins, plans and settings — it is more dangerous than
 *  an app token. sessionStorage dies with the tab, so a panel left open on
 *  someone else's machine is less of a risk.
 *
 *  The server address stays in localStorage: it is not a secret, and typing
 *  it every time would be tiresome.
 */
export const store = {
  get base()  {
    return sessionStorage.getItem(BASE_KEY) || localStorage.getItem(BASE_KEY) || DEFAULT_BASE;
  },
  set base(v) { localStorage.setItem(BASE_KEY, v); },
  get token() { return sessionStorage.getItem(TOKEN_KEY) || ''; },
  set token(v){ v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); },
  get me()    { try { return JSON.parse(sessionStorage.getItem(ADMIN_KEY) || 'null'); } catch { return null; } },
  set me(v)   { v ? sessionStorage.setItem(ADMIN_KEY, JSON.stringify(v)) : sessionStorage.removeItem(ADMIN_KEY); },
  clear() { this.token = ''; this.me = null; },
};

/** Full URL for an admin endpoint */
export const url = (path) => `${store.base.replace(/\/$/, '')}/api/admin${path}`;

export class ApiError extends Error {
  constructor(message, status, code, body) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body || {};
  }
}

let onSessionLost = () => {};
export const setSessionLostHandler = (fn) => { onSessionLost = fn; };

/**
 * Every request goes through here.
 *
 *  A 401 sends you straight back to the login screen. An admin token lasts
 *  12 hours, so this happens daily — if each page had to handle it, one of
 *  them would eventually forget.
 */
export const request = async (method, path, { body, query } = {}) => {
  if (!store.base) throw new ApiError('Server address is not set', 0, 'NO_BASE');

  const qs = query
    ? '?' + new URLSearchParams(
        Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null)
      )
    : '';

  let res;
  try {
    res = await fetch(url(path) + qs, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(store.token ? { Authorization: `Bearer ${store.token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // Network or CORS — by far the most common cause is a wrong server address
    throw new ApiError(
      'Could not reach the server. Check the address and that it is running.',
      0, 'NETWORK'
    );
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    store.clear();
    onSessionLost(data.message || 'Your session ended. Please sign in again.');
    throw new ApiError(data.message || 'Not authorized', 401, data.code, data);
  }

  if (!res.ok) {
    throw new ApiError(
      data.message || data.error || `Request failed (${res.status})`,
      res.status, data.code, data
    );
  }

  return data;
};

export const api = {
  get:  (p, query) => request('GET', p, { query }),
  post: (p, body)  => request('POST', p, { body }),
  put:  (p, body)  => request('PUT', p, { body }),
  del:  (p, body)  => request('DELETE', p, { body }),
};

/**
 * Does this admin hold any of these permissions?
 *
 *  This is convenience only — it hides menus and buttons. The real check is
 *  on the server: open a URL directly and the backend still answers 403.
 */
export const can = (...perms) => {
  const mine = store.me?.permissions || [];
  return perms.some((p) => mine.includes(p));
};
