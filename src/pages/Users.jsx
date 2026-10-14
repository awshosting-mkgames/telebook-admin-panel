import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, ConfirmBox, Modal, Pager, Spinner, StatusBadge, Table,
  fmtDate, fmtMoney, fmtNum, useToast,
} from '../ui/index.jsx';
import { ExportDialog } from './Messages.jsx';

/**
 * The count is highlighted from this many messages up.
 *
 *  This is purely VISUAL — no limit is applied, nothing is blocked, and the
 *  user never learns of it. It only makes a heavy sender stand out in the
 *  list.
 */
const BUSY_AT = 1000;

// ── List ────────────────────────────────────────────────────────────────────
function UserList({ params, patch }) {
  const q = {
    q: params.get('q') || '',
    status: params.get('status') || 'all',
    plan: params.get('plan') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };

  const { data, loading } = useApi(() => api.get('/users', q),
    [q.q, q.status, q.plan, q.sort, q.page]);

  return (
    <>
      <h1 className="h4 mb-3">Users</h1>

      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({
          q: f.get('q'), status: f.get('status'), plan: f.get('plan'),
          sort: f.get('sort'), page: 1,
        });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">Search</label>
            <input name="q" className="form-control" placeholder="Name or mobile"
                   defaultValue={q.q} key={q.q} />
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Status</label>
            <select name="status" className="form-select" defaultValue={q.status} key={q.status}>
              {['all', 'active', 'blocked', 'deleted'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Plan</label>
            <select name="plan" className="form-select" defaultValue={q.plan} key={q.plan}>
              <option value="">any</option>
              {['basic', 'premium', 'vip', 'none'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Sort</label>
            <select name="sort" className="form-select" defaultValue={q.sort} key={q.sort}>
              <option value="newest">Newest</option>
              <option value="messages">Most messages</option>
            </select>
          </div>
          <div className="col-md-2">
            <button className="btn btn-primary w-100" type="submit">Apply</button>
          </div>
        </div>
      </form>

      {loading ? <Spinner /> : (
        <Card title="Users">
          <Table columns={[
            { title: 'User', render: (u) => (
              <div className="d-flex flex-column">
                <Link to={`/users?id=${u._id}`} className="fw-semibold text-decoration-none">
                  {u.name || '—'}
                </Link>
                <span className="text-secondary small">{u.mobile}</span>
              </div>
            ) },
            { title: 'Plan', render: (u) => !u.plan?.code
              ? <span className="text-secondary">Free</span>
              : (
                <>
                  <Badge kind={u.plan.isActive ? 'success' : 'secondary'}>
                    {u.plan.name || u.plan.code}
                  </Badge>
                  <div className="text-secondary small">
                    {u.plan.expiresAt ? `till ${fmtDate(u.plan.expiresAt)}` : ''}
                  </div>
                </>
              ) },
            { title: 'Messages', className: 'text-end', render: (u) => (
              (u.messageCount || 0) >= BUSY_AT
                ? <span className="fw-semibold text-warning-emphasis bg-warning-subtle px-2 py-1 rounded"
                        title={`${BUSY_AT}+ messages`}>{fmtNum(u.messageCount)}</span>
                : fmtNum(u.messageCount)
            ) },
            { title: 'Status', render: (u) =>
              u.isDeleted ? <StatusBadge status="deleted" />
              : u.isBlocked ? (
                <>
                  <StatusBadge status="blocked" />
                  <div className="text-secondary small">{u.blockReason || ''}</div>
                </>
              ) : u.isOnline ? <Badge kind="success">online</Badge> : <Badge kind="light">offline</Badge> },
            { title: 'Joined', render: (u) => <span className="text-secondary small">{fmtDate(u.createdAt)}</span> },
            { title: '', className: 'text-end', render: (u) => (
              <Link to={`/users?id=${u._id}`} className="btn btn-sm btn-outline-secondary">Open</Link>
            ) },
          ]} rows={data?.data?.users || []} empty="No users found" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ page: p })} />
        </Card>
      )}
    </>
  );
}

// ── Detail ──────────────────────────────────────────────────────────────────
function UserDetail({ id, patch }) {
  const can = useCan();
  const { toast, showError } = useToast();
  const { data, loading, reload } = useApi(() => api.get(`/users/${id}`), [id]);
  const [dialog, setDialog] = useState(null);   // 'block' | 'limit' | 'plan' | 'coins' | 'reset' | {revoke}
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (loading) return <Spinner />;
  const d = data?.data;
  if (!d) return null;
  const u = d.user;

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { const out = await fn(); toast(out?.message || okMsg); setDialog(null); reload(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const openPlan = async () => {
    try {
      const res = await api.get('/plans');
      setPlans(res.data.plans);
      setDialog('plan');
    } catch (err) { showError(err); }
  };

  const row = (k, v) => (
    <div key={k} className="row mb-1">
      <dt className="col-5 text-secondary fw-normal small">{k}</dt>
      <dd className="col-7 mb-1">{v}</dd>
    </div>
  );

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <Link to="/users" className="btn btn-sm btn-light"><i className="bi bi-arrow-left" /></Link>
        <h1 className="h4 mb-0">{u.name || 'Unnamed'}</h1>
        <span className="text-secondary">{u.mobile}</span>
        {u.isBlocked && <StatusBadge status="blocked" />}
        {u.isDeleted && <StatusBadge status="deleted" />}
        <div className="ms-auto d-flex gap-2 flex-wrap">
          {can('users.block') && !u.isDeleted && (
            <button className={`btn btn-sm btn-${u.isBlocked ? 'success' : 'outline-danger'}`}
                    onClick={() => setDialog('block')}>
              {u.isBlocked ? 'Restore account' : 'Suspend account'}
            </button>
          )}
          {can('subscriptions.grant') && (
            <button className="btn btn-sm btn-outline-primary" onClick={openPlan}>Give plan</button>
          )}
          {can('coins.adjust') && (
            <button className="btn btn-sm btn-outline-primary" onClick={() => setDialog('coins')}>
              Adjust coins
            </button>
          )}
          {can('messages.view') && (
            <Link to={`/messages?userId=${u._id}`} className="btn btn-sm btn-outline-secondary">Chats</Link>
          )}
          {can('messages.export') && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setExporting(true)}>
              <i className="bi bi-download" /> Chat export
            </button>
          )}
        </div>
      </div>

      {u.isBlocked && (
        <div className="alert alert-danger py-2">
          <strong>Suspended.</strong> {u.blockReason || ''}
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-6">
          <Card title="Profile">
            <dl className="mb-0 p-3">
              {row('Mobile', u.mobile)}
              {row('Name', u.name || '—')}
              {row('About', u.about || '—')}
              {row('City', u.city || '—')}
              {row('State', u.state || '—')}
              {row('Verified', u.isVerified ? 'yes' : 'no')}
              {row('Two-step PIN', u.twoStepEnabled ? 'on' : 'off')}
              {row('Auto Reply', u.autoReplyEnabled ? 'on' : 'off')}
              {row('Theme', u.theme || 'default')}
              {row('Joined', fmtDate(u.createdAt))}
              {row('Last seen', u.isOnline ? 'online' : fmtDate(u.lastSeen))}
            </dl>
          </Card>
        </div>

        <div className="col-lg-6">
          <Card title="Plan">
            <dl className="mb-0 p-3">
              {row('Plan', d.plan.planName || 'Free')}
              {row('Active', d.plan.isActive ? 'yes' : 'no')}
              {row('Days left', d.plan.isActive ? fmtNum(d.plan.daysRemaining) : '—')}
              {row('Expires', d.plan.endAt ? fmtDate(d.plan.endAt) : '—')}
              {row('Source', d.plan.source || '—')}
            </dl>
            <div className="px-3 pb-3">
              <details>
                <summary className="small text-primary" style={{ cursor: 'pointer' }}>
                  What this user gets
                </summary>
                <table className="table table-sm mt-2 mb-0">
                  <tbody>
                    {Object.entries(d.plan.limits || {}).map(([k, v]) => (
                      <tr key={k}>
                        <td className="text-secondary small border-0 ps-0">{k}</td>
                        <td className="text-end border-0 pe-0">
                          {v === -1 || v === 'unlimited' ? '∞'
                            : typeof v === 'boolean' ? (v ? 'on' : 'off') : fmtNum(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="form-text">
                  A copy taken when the plan was bought — later changes to its
                  price or limits do not change this user's terms.
                </div>
              </details>
            </div>
          </Card>

          <Card title="Wallet" actions={can('coins.view') && (
            <Link to={`/coins?tab=ledger&userId=${u._id}`} className="btn btn-sm btn-outline-secondary">
              Ledger
            </Link>
          )}>
            <dl className="mb-0 p-3">
              {row('Balance', <><strong>{fmtNum(d.wallet.balance)}</strong> coins</>)}
              {row('Total added', fmtNum(d.wallet.totalCredited))}
              {row('Total spent', fmtNum(d.wallet.totalDebited))}
              {row('Last activity', fmtDate(d.wallet.lastTxAt))}
            </dl>
          </Card>
        </div>

        <div className="col-lg-6">
          <Card title="Activity">
            <Table columns={[
              { title: 'What', render: ([k]) => k },
              { title: 'Count', className: 'text-end', render: ([k, v]) => (
                (k === 'Messages sent' && (v || 0) >= BUSY_AT)
                  ? <span className="fw-semibold text-warning-emphasis bg-warning-subtle px-2 py-1 rounded"
                          title={`${BUSY_AT}+ messages`}>{fmtNum(v)}</span>
                  : fmtNum(v)
              ) },
            ]} rows={[
              ['Messages sent', d.activity.messagesSent],
              ['Direct chats', d.activity.directChats],
              ['Groups joined', d.activity.groupsJoined],
              ['Groups owned', d.activity.groupsOwned],
              ['Calls', d.activity.calls],
            ]} rowKey={([k]) => k} />
          </Card>
        </div>

        <div className="col-lg-6">
          <Card title={`Devices (${d.devices.length})`}>
            <Table columns={[
              { title: 'Device', render: (x) => (
                <>
                  {x.deviceName || x.deviceId}
                  {x.isCurrent && <Badge kind="info">this device</Badge>}
                  <div className="text-secondary small">
                    {x.deviceType} {x.osVersion || ''} · app {x.appVersion || '—'}
                  </div>
                </>
              ) },
              { title: 'Last active', render: (x) => (
                <span className="small text-secondary">{fmtDate(x.lastActiveAt)}</span>
              ) },
              { title: '', className: 'text-end', render: (x) => can('users.block') && (
                <button className="btn btn-sm btn-outline-danger"
                        onClick={() => setDialog({ revoke: x.deviceId })}>Sign out</button>
              ) },
            ]} rows={d.devices} rowKey={(x) => x.deviceId} empty="No devices signed in" />
          </Card>
        </div>
      </div>

      {/* ── Dialogs ── */}
      {dialog === 'block' && (
        <ConfirmBox
          title={u.isBlocked ? 'Restore account' : 'Suspend account'}
          message={u.isBlocked
            ? <>The account for <strong>{u.mobile}</strong> becomes active again.</>
            : <>The account for <strong>{u.mobile}</strong> is suspended. All their
                devices are signed out and the app shows "suspended".</>}
          confirmText={u.isBlocked ? 'Restore' : 'Suspend'}
          danger={!u.isBlocked}
          needReason={!u.isBlocked}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={(v) => act(
            () => api.put(`/users/${u._id}/block`, { blocked: !u.isBlocked, reason: v.reason }),
            u.isBlocked ? 'Account restored' : 'Account suspended'
          )}
        />
      )}

      {dialog === 'plan' && (
        <Modal title="Give a plan" onClose={() => setDialog(null)} confirmText="Activate" busy={busy}
               onSubmit={(v) => act(
                 () => api.post('/subscriptions', {
                   userId: u._id, planCode: v.planCode, note: v.note,
                   ...(v.durationDays ? { durationDays: Number(v.durationDays) } : {}),
                 }),
                 'Plan activated'
               )}>
          <label className="form-label">Plan</label>
          <select name="planCode" className="form-select mb-3" required>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>{p.name} — ₹{p.price}/{p.durationDays}d</option>
            ))}
          </select>
          <label className="form-label">Days (optional)</label>
          <input name="durationDays" type="number" min="1" className="form-control mb-3"
                 placeholder="the plan default" />
          <label className="form-label">Note</label>
          <input name="note" className="form-control" placeholder="how the money arrived — e.g. 'paid by UPI'" />
        </Modal>
      )}

      {dialog === 'coins' && (
        <Modal title="Adjust coins" onClose={() => setDialog(null)} confirmText="Apply" busy={busy}
               onSubmit={(v) => act(
                 () => api.post('/coins/adjust', {
                   userId: u._id, amount: Number(v.amount),
                   direction: v.direction, reason: v.reason,
                 }),
                 'Coins updated'
               )}>
          <div className="mb-3">Current balance: <strong>{fmtNum(d.wallet.balance)}</strong> coins</div>
          <label className="form-label">Direction</label>
          <select name="direction" className="form-select mb-3">
            <option value="credit">Add coins</option>
            <option value="debit">Remove coins</option>
          </select>
          <label className="form-label">Coins</label>
          <input name="amount" type="number" min="1" className="form-control mb-3" required />
          <label className="form-label">Reason <span className="text-danger">*</span></label>
          <input name="reason" className="form-control" required placeholder="e.g. 'paid cash at the shop'" />
          <div className="form-text">It goes to the audit log — every entry touching money has to be answerable.</div>
        </Modal>
      )}

      {dialog?.revoke && (
        <ConfirmBox
          title="Sign out device"
          message="That phone's token stops working immediately."
          confirmText="Sign out" busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => act(
            () => api.del(`/users/${u._id}/devices/${encodeURIComponent(dialog.revoke)}`),
            'Device signed out'
          )}
        />
      )}

      {exporting && <ExportDialog userId={u._id} onClose={() => setExporting(false)} />}
    </>
  );
}

export default function Users() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const id = params.get('id');
  return id ? <UserDetail id={id} patch={patch} /> : <UserList params={params} patch={patch} />;
}
