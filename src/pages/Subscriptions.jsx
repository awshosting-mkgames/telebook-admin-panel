import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, ConfirmBox, Modal, Pager, Spinner, StatusBadge, Table,
  fmtDate, fmtMoney, useToast,
} from '../ui/index.jsx';

const daysLeft = (endAt) => (endAt ? Math.ceil((new Date(endAt) - Date.now()) / 86400000) : null);

export default function Subscriptions() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const can = useCan();
  const { toast, showError } = useToast();
  const [dialog, setDialog] = useState(null);     // {kind, userId?}
  const [busy, setBusy] = useState(false);

  const q = {
    status: params.get('status') ?? 'active',
    planCode: params.get('planCode') || '',
    source: params.get('source') || '',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };

  const { data, loading, reload } = useApi(
    async () => {
      const [subs, plans] = await Promise.all([api.get('/subscriptions', q), api.get('/plans')]);
      return { subs: subs.data, plans: plans.data.plans };
    },
    [q.status, q.planCode, q.source, q.page]
  );

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { const out = await fn(); toast(out?.message || okMsg); setDialog(null); reload(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const grant = async (v) => {
    setBusy(true);
    try {
      // The panel has a mobile number, the API needs a userId — look it up first
      const found = await api.get('/users', { q: v.mobile, limit: 5 });
      const user = (found.data.users || []).find((u) => u.mobile === v.mobile.trim())
        || found.data.users?.[0];
      if (!user) throw new Error(`No user found for ${v.mobile}`);

      const out = await api.post('/subscriptions', {
        userId: user._id, planCode: v.planCode, note: v.note,
        ...(v.durationDays ? { durationDays: Number(v.durationDays) } : {}),
      });
      toast(out.message || 'Plan activated');
      setDialog(null);
      reload();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const plans = data?.plans || [];

  return (
    <>
      <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h4 mb-0">Subscriptions</h1>
        {can('subscriptions.grant') && (
          <button className="btn btn-primary btn-sm ms-auto" onClick={() => setDialog({ kind: 'grant' })}>
            <i className="bi bi-plus-lg" /> Give plan
          </button>
        )}
      </div>

      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({ status: f.get('status'), planCode: f.get('planCode'), source: f.get('source'), page: 1 });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small mb-1">Status</label>
            <select name="status" className="form-select" defaultValue={q.status} key={q.status}>
              <option value="active">active</option>
              <option value="expired">expired</option>
              <option value="cancelled">cancelled</option>
              <option value="superseded">Upgraded/Replaced</option>
              <option value="">all</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Plan</label>
            <select name="planCode" className="form-select" defaultValue={q.planCode} key={q.planCode}>
              <option value="">any</option>
              {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">How it was bought</label>
            <select name="source" className="form-select" defaultValue={q.source} key={q.source}>
              <option value="">any</option>
              {['manual', 'play', 'gateway'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Apply</button></div>
        </div>
      </form>

      {loading ? <Spinner /> : (
        <Card>
          <Table columns={[
            { title: 'User', render: (s) => s.user ? (
              <>
                <Link to={`/users?id=${s.user._id}`} className="text-decoration-none fw-semibold">
                  {s.user.name || '—'}
                </Link>
                <div className="small text-secondary">{s.user.mobile}</div>
              </>
            ) : <span className="text-secondary">(deleted user)</span> },
            { title: 'Plan', render: (s) => (
              <>
                {s.planName || s.planCode}
                <div className="small text-secondary">{fmtMoney(s.price)}</div>
              </>
            ) },
            { title: 'Status', render: (s) => s.status === 'superseded'
              ? <Badge kind="secondary">Upgraded/Replaced</Badge>
              : <StatusBadge status={s.status} /> },
            { title: 'How', render: (s) => (
              <>
                <Badge kind={s.source === 'manual' ? 'secondary' : 'primary'}>{s.source}</Badge>
                {s.grantedByName && <div className="small text-secondary">{s.grantedByName}</div>}
                {s.paymentTransaction && s.user && (
                  <div className="small">
                    <Link to={`/payments?userId=${s.user._id}`} className="text-decoration-none"
                          title={`Payment ${s.paymentTransaction}`}>
                      <i className="bi bi-receipt" /> payment
                    </Link>
                  </div>
                )}
              </>
            ) },
            { title: 'Started', render: (s) => <span className="small text-secondary">{fmtDate(s.startAt)}</span> },
            { title: 'Ends', render: (s) => {
              const d = daysLeft(s.endAt);
              if (d === null) return <span className="text-secondary">—</span>;
              const soon = s.status === 'active' && d <= 3;
              return (
                <>
                  <span className={soon ? 'text-danger fw-semibold' : ''}>{fmtDate(s.endAt)}</span>
                  {s.status === 'active' && (
                    <div className="small text-secondary">
                      {d > 0 ? `${d} day(s) left` : 'ends today'}
                    </div>
                  )}
                </>
              );
            } },
            { title: 'Note', render: (s) => s.note
              ? <span className="small">{s.note}</span>
              : <span className="text-secondary">—</span> },
            { title: '', className: 'text-end', render: (s) =>
              (can('subscriptions.grant') && s.status === 'active' && s.user) ? (
                <div className="btn-group btn-group-sm">
                  <button className="btn btn-outline-secondary"
                          onClick={() => setDialog({ kind: 'extend', userId: s.user._id })}>Extend</button>
                  <button className="btn btn-outline-danger"
                          onClick={() => setDialog({ kind: 'cancel', userId: s.user._id })}>Cancel</button>
                </div>
              ) : null },
          ]} rows={data?.subs?.subscriptions || []} empty="No subscriptions found" />
          <Pager pagination={data?.subs?.pagination} onPage={(p) => patch({ page: p })} />
        </Card>
      )}

      {dialog?.kind === 'grant' && (
        <Modal title="Give a plan" confirmText="Activate" busy={busy}
               onClose={() => setDialog(null)} onSubmit={grant}>
          <div className="alert alert-info py-2 small">
            This is <strong>manual</strong> mode — the money arrived outside the app
            (cash, UPI, a shop). A payment record is still written, so the revenue
            report stays complete.
          </div>
          <label className="form-label">User's mobile <span className="text-danger">*</span></label>
          <input name="mobile" className="form-control mb-1" required placeholder="+919876543210" />
          <div className="form-text mb-3">The user must already be registered in the app.</div>
          <label className="form-label">Plan</label>
          <select name="planCode" className="form-select mb-3" required>
            {plans.filter((p) => p.isActive).map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {fmtMoney(p.price)} / {p.durationDays}d
              </option>
            ))}
          </select>
          <label className="form-label">Days (optional)</label>
          <input name="durationDays" type="number" min="1" className="form-control mb-3"
                 placeholder="empty = the plan default" />
          <label className="form-label">Note <span className="text-danger">*</span></label>
          <input name="note" className="form-control" required placeholder="how the money arrived" />
        </Modal>
      )}

      {dialog?.kind === 'extend' && (
        <Modal title="Extend the plan" confirmText="Extend" busy={busy}
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(
                 () => api.post(`/subscriptions/${dialog.userId}/extend`,
                   { days: Number(v.days), reason: v.reason }),
                 'Extended'
               )}>
          <label className="form-label">How many days</label>
          <input name="days" type="number" min="1" className="form-control mb-3" defaultValue={30} required />
          <label className="form-label">Reason</label>
          <input name="reason" className="form-control" placeholder="e.g. 'service was down'" />
        </Modal>
      )}

      {dialog?.kind === 'cancel' && (
        <ConfirmBox
          title="Cancel the plan"
          message={<>The plan ends now. <strong>No user data is lost</strong> — only the
            premium features lock.</>}
          confirmText="Cancel plan" needReason busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={(v) => act(
            () => api.post(`/subscriptions/${dialog.userId}/cancel`, { reason: v.reason }),
            'Plan cancelled'
          )}
        />
      )}
    </>
  );
}
