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
 * Message limit = per-user `messageLimit`, else the global default
 * (`messaging.defaultMessageLimit`, returned by the list API).
 *
 *  This is a REPORT limit only — exceeding it never blocks messaging and the
 *  user never learns of it. It only puts the user on the "Over limit" list.
 */
const effLimit = (u, def) => u.messageLimit ?? def;
const isOver = (u, def) => (u.messageCount || 0) > effLimit(u, def);

// ── List ────────────────────────────────────────────────────────────────────
function UserList({ params, patch }) {
  const q = {
    q: params.get('q') || '',
    status: params.get('status') || 'all',
    plan: params.get('plan') || '',
    sort: params.get('sort') || 'newest',
    overLimit: params.get('overLimit') === 'true' ? 'true' : '',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };

  const { data, loading } = useApi(() => api.get('/users', q),
    [q.q, q.status, q.plan, q.sort, q.overLimit, q.page]);
  const def = data?.data?.defaultMessageLimit ?? 1000;

  return (
    <>
      <h1 className="h4 mb-3">Users</h1>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${q.overLimit ? '' : 'active'}`}
                  onClick={() => patch({ overLimit: '', page: 1 })}>All users</button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${q.overLimit ? 'active' : ''}`}
                  onClick={() => patch({ overLimit: 'true', page: 1 })}>Over limit</button>
        </li>
      </ul>

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

      <div className="form-text mb-2">
        The message limit is a report only — going over it never blocks a user
        from sending messages, and the user is not told.
      </div>

      {loading ? <Spinner /> : (
        <Card title={q.overLimit ? 'Users over their message limit' : 'Users'}>
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
            { title: 'Messages (used / limit)', className: 'text-end', render: (u) => {
              const txt = `${fmtNum(u.messageCount)}/${fmtNum(effLimit(u, def))}`;
              return isOver(u, def)
                ? <span className="fw-semibold text-danger bg-danger-subtle px-2 py-1 rounded"
                        title="Over the message limit (messaging is not blocked)">{txt}</span>
                : <span title={u.messageLimit == null ? 'Global default limit' : 'Custom limit'}>{txt}</span>;
            } },
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
          ]} rows={data?.data?.users || []}
             empty={q.overLimit ? 'No user is over the limit' : 'No users found'} />
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
  const defLimit = d.defaultMessageLimit ?? 1000;
  const used = u.messageCount || 0;
  const limit = u.messageLimit ?? defLimit;
  const over = used > limit;

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
          {can('users.limit') && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setDialog('limit')}>
              Edit limit
            </button>
          )}
          {can('users.limit') && (
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setDialog('reset')}>
              Reset counter
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
              { title: 'Count', className: 'text-end', render: ([k, v]) => fmtNum(v) },
            ]} rows={[
              ['Direct chats', d.activity.directChats],
              ['Groups joined', d.activity.groupsJoined],
              ['Groups owned', d.activity.groupsOwned],
              ['Calls', d.activity.calls],
            ]} rowKey={([k]) => k} />
            <dl className="mb-0 p-3 border-top">
              {row('Usage', (
                <span className={over ? 'fw-semibold text-danger' : ''}>
                  {fmtNum(used)} / {fmtNum(limit)}
                  {over && <Badge kind="danger">over limit</Badge>}
                </span>
              ))}
              {row('Remaining', over ? '0' : fmtNum(limit - used))}
              {row('Limit source', u.messageLimit == null
                ? `global default (${fmtNum(defLimit)})` : 'custom for this user')}
            </dl>
            <div className="form-text px-3 pb-3">
              The limit is for reporting only — going over it never blocks messaging.
            </div>
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

      {dialog === 'limit' && (
        <Modal title="Edit message limit" onClose={() => setDialog(null)} confirmText="Save" busy={busy}
               onSubmit={(v) => act(
                 () => api.put(`/users/${u._id}/message-limit`, {
                   limit: v.limit === '' ? null : Number(v.limit),
                 }),
                 'Limit updated'
               )}>
          <div className="mb-3">Used so far: <strong>{fmtNum(used)}</strong> messages</div>
          <label className="form-label">Limit</label>
          <input name="limit" type="number" min="0" className="form-control"
                 defaultValue={u.messageLimit ?? ''} placeholder={`empty = global default (${fmtNum(defLimit)})`} />
          <div className="form-text">
            Empty uses the global default. Going over the limit only adds the user
            to the "Over limit" list — messaging is never blocked. The change is
            written to the audit log.
          </div>
        </Modal>
      )}

      {dialog === 'reset' && (
        <ConfirmBox
          title="Reset message counter"
          message={<>The message counter of <strong>{u.mobile}</strong> ({fmtNum(used)} sent)
            goes back to 0.</>}
          confirmText="Reset" needReason busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={(v) => act(
            () => api.post(`/users/${u._id}/reset-message-count`, { reason: v.reason }),
            'Message counter reset'
          )}
        />
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
