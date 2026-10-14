import { createContext, useCallback, useContext, useState } from 'react';
import { ApiError } from '../api.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Toast — a short word on whether something worked
// ─────────────────────────────────────────────────────────────────────────────

const ToastCtx = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};

const KIND = {
  success: { cls: 'text-bg-success', icon: 'check-circle' },
  danger:  { cls: 'text-bg-danger',  icon: 'exclamation-triangle' },
  warning: { cls: 'text-bg-warning', icon: 'exclamation-circle' },
  info:    { cls: 'text-bg-secondary', icon: 'info-circle' },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setItems((list) => [...list, { id, message, kind }]);
    // Errors stay longer — they take longer to read
    setTimeout(() => remove(id), kind === 'danger' ? 7000 : 4000);
  }, [remove]);

  /**
   * One way to show an API failure.
   *
   *  The server's `code` is shown alongside — on a support call, saying
   *  "FEATURE_OFF" is far more useful than "something went wrong".
   */
  const showError = useCallback((err) => {
    const msg = err instanceof ApiError
      ? `${err.message}${err.code ? ` (${err.code})` : ''}`
      : err?.message || 'Something went wrong';
    toast(msg, 'danger');
  }, [toast]);

  return (
    <ToastCtx.Provider value={{ toast, showError }}>
      {children}
      <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1090 }}>
        {items.map((t) => {
          const k = KIND[t.kind] || KIND.info;
          return (
            <div key={t.id} className={`toast show align-items-center border-0 ${k.cls}`} role="alert">
              <div className="d-flex">
                <div className="toast-body">
                  <i className={`bi bi-${k.icon} me-2`} />
                  {t.message}
                </div>
                <button type="button" className="btn-close btn-close-white me-2 m-auto"
                        onClick={() => remove(t.id)} aria-label="Close" />
              </div>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
