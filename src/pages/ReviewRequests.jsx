import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import { Badge, Card, Modal, Pager, Spinner, Table, fmtDate, fmtNum, useToast } from '../ui/index.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  Review requests — a suspended user taps "Request a review" in the app.
//  Accept = the account is restored right away. Reject = a note is required and
//  the user sees it on their suspension screen (and can ask again).
// ─────────────────────────────────────────────────────────────────────────────

const KIND = { pending: 'warning', accepted: 'success', rejected: 'danger' };

export default function ReviewRequests() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const { toast, showError } = useToast();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const status = params.get('status') || 'pending';
  const page = Number(params.get('page')) || 1;

  const { data, loading, reload } = useApi(
    () => api.get('/review-requests', { ...(status !== 'all' ? { status } : {}), page, limit: 25 }),
    [status, page]
  );

  const decide = async (decision, note) => {
    setBusy(true);
    try {
      const out = await api.put(`/review-requests/${dialog.r._id}`, { decision, note });
      toast(out?.message || 'Done');
      setDialog(null);
      reload();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h4 mb-0">Review requests</h1>
        {!!data?.data?.pendingCount && <Badge kind="warning">{fmtNum(data.data.pendingCount)} pending</Badge>}
      </div>
      <p className="text-secondary small">
        Suspended users can ask for a review from the suspension screen in the app. Accepting restores the account
        immediately; rejecting needs a note that the user will see.
      </p>

      <ul className="nav nav-pills mb-3 gap-1">
        {[['pending', 'Pending'], ['accepted', 'Accepted'], ['rejected', 'Rejected'], ['all', 'All']].map(([v, l]) => (
          <li className="nav-item" key={v}>
            <Link className={`nav-link ${status === v ? 'active' : ''}`} to={`/review-requests?status=${v}`}>{l}</Link>
          </li>
        ))}
      </ul>

      {loading ? <Spinner /> : (
        <Card>
          <Table columns={[
            { title: 'User', render: (r) => (
              <div>
                <div className="fw-semibold">{r.user?.name || '—'}</div>
                <div className="small text-secondary">{r.user?.mobile || ''}{r.user?.isBlocked ? '' : ' · not suspended'}</div>
              </div>
            ) },
            { title: 'Suspended for', render: (r) => <span className="small">{r.blockReason || '—'}</span> },
            { title: 'User message', render: (r) => <span className="small">{r.message || '—'}</span> },
            { title: 'Requested', render: (r) => fmtDate(r.createdAt) },
            { title: 'Status', render: (r) => (
              <div>
                <Badge kind={KIND[r.status]}>{r.status}</Badge>
                {r.decidedBy && <div className="small text-secondary">{r.decidedBy}</div>}
                {r.adminNote && <div className="small">{r.adminNote}</div>}
              </div>
            ) },
            { title: '', className: 'text-end', render: (r) => (
              r.status === 'pending' && can('reviews.manage') ? (
                <div className="btn-group btn-group-sm">
                  <button className="btn btn-outline-success" onClick={() => setDialog({ kind: 'accept', r })}>Accept</button>
                  <button className="btn btn-outline-danger" onClick={() => setDialog({ kind: 'reject', r })}>Reject</button>
                </div>
              ) : null
            ) },
          ]} rows={data?.data?.requests || []} empty="No review requests" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ status, page: p })} />
        </Card>
      )}

      {dialog?.kind === 'accept' && (
        <Modal title="Accept review" confirmText="Accept & restore account" busy={busy}
               onClose={() => setDialog(null)} onSubmit={(v) => decide('accept', v.note)}>
          <p>The account of <strong>{dialog.r.user?.name || dialog.r.user?.mobile}</strong> will be restored right away.</p>
          <label className="form-label">Note (optional)</label>
          <textarea name="note" className="form-control" rows="3" maxLength={1000} />
        </Modal>
      )}
      {dialog?.kind === 'reject' && (
        <Modal title="Reject review" confirmText="Reject" busy={busy}
               onClose={() => setDialog(null)} onSubmit={(v) => decide('reject', v.note)}>
          <p>The account stays suspended. The user will see your note and can request again.</p>
          <label className="form-label">Note for the user <span className="text-danger">*</span></label>
          <textarea name="note" className="form-control" rows="3" maxLength={1000} required />
        </Modal>
      )}
    </>
  );
}
