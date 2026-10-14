import { useState } from 'react';
import { DEFAULT_BASE, store } from './api.js';
import { useAuth } from './auth.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  Login — email and password only
//
//  The server address comes from `.env` (VITE_API_BASE_URL), so an admin is
//  never asked for it. Like any normal panel.
//
//  One case brings that field back: when the server cannot be reached at all
//  (wrong address, server down, or the panel deployed on another domain).
//  Telling someone to rebuild at that moment is a poor answer — so the
//  address can be corrected right there, and the browser remembers it.
// ─────────────────────────────────────────────────────────────────────────────

export default function Login() {
  const { signIn, notice } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // If an address was already set by hand, keep the field open
  const [showBase, setShowBase] = useState(
    !!localStorage.getItem('tb_admin_base') && store.base !== DEFAULT_BASE
  );

  const submit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const base = String(f.get('base') || store.base).trim();

    setBusy(true);
    setError('');
    try {
      await signIn({
        base,
        email: String(f.get('email')).trim(),
        password: String(f.get('password')),
      });
    } catch (err) {
      setError(err?.message || 'Sign in failed');
      // The server could not be reached — offer a way to fix the address
      if (err?.code === 'NETWORK' || err?.code === 'NO_BASE') setShowBase(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <form className="card shadow login-card" onSubmit={submit}>
        <div className="card-body p-4">
          <h1 className="h4 mb-1">
            <i className="bi bi-gear-fill text-primary me-2" />
            Telebook Admin
          </h1>
          <p className="text-secondary small mb-4">Authorised staff only.</p>

          {(error || notice) && (
            <div className={`alert ${error ? 'alert-danger' : 'alert-secondary'} py-2 small`}>
              {error || notice}
            </div>
          )}

          <label className="form-label">Email</label>
          <input name="email" type="email" className="form-control mb-3" required
                 autoComplete="username" autoFocus />

          <label className="form-label">Password</label>
          <input name="password" type="password" className="form-control mb-4" required
                 autoComplete="current-password" />

          {showBase && (
            <div className="mb-4">
              <label className="form-label">Server address</label>
              <input name="base" className="form-control mb-1" defaultValue={store.base}
                     autoComplete="off" placeholder="https://api.telebook.app" />
              <div className="form-text">
                The backend's address — without <code>/api/admin</code>. This browser
                will remember it.
              </div>
            </div>
          )}

          <button className="btn btn-primary w-100" disabled={busy}>
            {busy && <span className="spinner-border spinner-border-sm me-2" />}
            Sign in
          </button>

          {!showBase && (
            <button type="button" className="btn btn-link btn-sm w-100 text-secondary mt-2"
                    onClick={() => setShowBase(true)}>
              Need to change the server address?
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
