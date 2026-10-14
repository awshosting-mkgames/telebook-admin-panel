import { useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
//  Modal — Bootstrap's classes, React's control
//
//  Bootstrap's own modal JavaScript is deliberately not used: it opens and
//  closes DOM nodes itself, and React manages the same node. With both
//  running, the modal stops closing or the backdrop sticks to the screen.
//  Same markup, control stays with React.
//
//  The form lives inside, so a page only has to handle `onSubmit` — the
//  values arrive straight from FormData.
// ─────────────────────────────────────────────────────────────────────────────

export default function Modal({
  title,
  children,
  onClose,
  onSubmit,
  confirmText = 'Save',
  cancelText = 'Cancel',
  danger = false,
  busy = false,
  size = '',           // '', 'modal-lg', 'modal-xl'
}) {
  const formRef = useRef(null);

  // Escape closes it — every modal is expected to do this
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [onClose, busy]);

  // Focus the first input — for people working from the keyboard
  useEffect(() => {
    const el = formRef.current?.querySelector('input, select, textarea');
    el?.focus();
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(e.target).entries());
    onSubmit?.(values, e.target);
  };

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog"
           onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${size}`}>
          <form className="modal-content" onSubmit={submit} ref={formRef}>
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose}
                      disabled={busy} aria-label="Close" />
            </div>
            <div className="modal-body">{children}</div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" onClick={onClose} disabled={busy}>
                {cancelText}
              </button>
              <button type="submit" className={`btn btn-${danger ? 'danger' : 'primary'}`} disabled={busy}>
                {busy && <span className="spinner-border spinner-border-sm me-2" />}
                {confirmText}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}

/**
 * A yes/no modal.
 *
 *  With `needReason`, a reason becomes required — the backend asks for one on
 *  anything touching money, accounts or content, and it goes to the audit log.
 */
export function ConfirmBox({
  title, message, onCancel, onConfirm,
  confirmText = 'Confirm', danger = true, needReason = false, busy = false,
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      onSubmit={(values) => onConfirm(values)}
      confirmText={confirmText}
      danger={danger}
      busy={busy}
    >
      <div className="mb-3">{message}</div>
      {needReason && (
        <>
          <label className="form-label">Reason <span className="text-danger">*</span></label>
          <input name="reason" className="form-control" required
                 placeholder="This goes on the record" />
          <div className="form-text">It is written to the audit log — so be clear.</div>
        </>
      )}
    </Modal>
  );
}
