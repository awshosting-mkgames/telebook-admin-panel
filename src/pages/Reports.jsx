import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, Modal, Pager, Spinner, StatusBadge, Table,
  fmtDate, fmtNum, useToast,
} from '../ui/index.jsx';

const REASONS = ['spam', 'abuse', 'nudity', 'violence', 'fraud', 'other'];
const TYPES = ['message', 'user', 'group', 'channel', 'status'];

// ── Queue ───────────────────────────────────────────────────────────────────
function Queue({ params, patch }) {
  const q = {
    status: params.get('status') || 'pending',
    type: params.get('type') || '',
    reason: params.get('reason') || '',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };
  const { data, loading } = useApi(() => api.get('/reports', q),
    [q.status, q.type, q.reason, q.page]);
  const sum = data?.data?.summary || {};

  return (
    <>
      <h1 className="h4 mb-3">Reports</h1>

      <ul className="nav nav-pills mb-3 gap-1">
        {[['pending', 'Pending'], ['reviewed', 'Reviewed'],
          ['dismissed', 'Dismissed'], ['all', 'All']].map(([v, label]) => (
          <li className="nav-item" key={v}>
            <Link className={`nav-link ${q.status === v ? 'active' : ''}`} to={`/reports?status=${v}`}>
              {label}
              {sum[v] ? <span className="badge bg-light text-dark ms-1">{fmtNum(sum[v])}</span> : null}
            </Link>
          </li>
        ))}
      </ul>

      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({ status: q.status, type: f.get('type'), reason: f.get('reason'), page: 1 });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small mb-1">Reported item</label>
            <select name="type" className="form-select" defaultValue={q.type} key={q.type}>
              <option value="">any</option>
              {TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Reason</label>
            <select name="reason" className="form-select" defaultValue={q.reason} key={q.reason}>
              <option value="">any</option>
              {REASONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Apply</button></div>
        </div>
      </form>

      {loading ? <Spinner /> : (
        <Card>
          <Table columns={[
            { title: 'What', render: (r) => (
              <>
                <Badge kind="dark">{r.reportType}</Badge>
                <div className="small text-secondary">{r.reason}</div>
              </>
            ) },
            { title: 'On what', render: (r) => r.reportedUser ? (
              <>
                <Link to={`/users?id=${r.reportedUser._id}`} className="text-decoration-none">
                  {r.reportedUser.name || r.reportedUser.mobile}
                </Link>
                {r.reportedUser.isBlocked && <StatusBadge status="blocked" />}
              </>
            ) : <span className="text-secondary">—</span> },
            { title: 'Reported by', render: (r) => r.reporter
              ? <span className="small">{r.reporter.name || r.reporter.mobile}</span>
              : <span className="text-secondary">—</span> },
            { title: 'Detail', render: (r) => r.description
              ? <span className="small">{r.description.slice(0, 80)}{r.description.length > 80 ? '…' : ''}</span>
              : <span className="text-secondary">—</span> },
            { title: 'Status', render: (r) => (
              <>
                <StatusBadge status={r.status} />
                {r.action && r.action !== 'none' && (
                  <div className="small text-secondary">{r.action}</div>
                )}
              </>
            ) },
            { title: 'Received', render: (r) => <span className="small text-secondary">{fmtDate(r.createdAt)}</span> },
            { title: '', className: 'text-end', render: (r) => (
              <Link to={`/reports?id=${r._id}`} className="btn btn-sm btn-outline-secondary">Open</Link>
            ) },
          ]} rows={data?.data?.reports || []}
             empty={q.status === 'pending' ? 'No reports pending — all clear' : 'No reports found'} />
          <Pager pagination={data?.data?.pagination}
                 onPage={(p) => patch({ status: q.status, page: p })} />
        </Card>
      )}
    </>
  );
}

// ── The reported item ───────────────────────────────────────────────────────
function Content({ c }) {
  if (!c) {
    return (
      <div className="text-secondary p-3">
        The reported item cannot be found — it may already have been removed.
      </div>
    );
  }

  if (c.kind === 'message') {
    return (
      <div className="p-3">
        <div className="small text-secondary mb-1">
          {c.sender ? (c.sender.name || c.sender.mobile) : 'unknown'} · {fmtDate(c.createdAt)}
          {c.isDeleted && <Badge kind="danger">already removed</Badge>}
        </div>
        <div className="border rounded p-3 bg-light">
          {c.messageType && c.messageType !== 'text' && <Badge kind="dark">{c.messageType}</Badge>}{' '}
          {c.text || <span className="text-secondary">(no text)</span>}
        </div>
        {c.attachments?.length > 0 && (
          <div className="small text-secondary mt-2">
            {c.attachments.length} attachment(s): {c.attachments.map((a) => a.fileName || a.key || '').join(', ')}
          </div>
        )}
      </div>
    );
  }
  if (c.kind === 'channel') {
    return (
      <div className="p-3">
        <div className="fw-semibold">{c.name} {c.isPrivate && <Badge>private</Badge>}</div>
        <div className="text-secondary small mb-2">
          {fmtNum(c.subscriberCount)} subscribers · banaya{' '}
          {c.creator ? (c.creator.name || c.creator.mobile) : '—'} ne · {fmtDate(c.createdAt)}
        </div>
        <div className="border rounded p-3 bg-light">{c.description || '(no description)'}</div>
      </div>
    );
  }
  if (c.kind === 'group') {
    return (
      <div className="p-3">
        <div className="fw-semibold">{c.name}</div>
        <div className="text-secondary small mb-2">
          {fmtNum(c.memberCount)} members · {fmtDate(c.createdAt)}
        </div>
        <div className="border rounded p-3 bg-light">{c.description || '(no description)'}</div>
      </div>
    );
  }
  if (c.kind === 'status') {
    return (
      <div className="p-3">
        <div className="small text-secondary mb-1">
          {c.user ? (c.user.name || c.user.mobile) : 'unknown'} ·{' '}
          <Badge kind="dark">{c.statusType}</Badge> · {fmtDate(c.createdAt)}
        </div>
        <div className="border rounded p-3 bg-light">{c.content || '(media only)'}</div>
        {c.mediaUrl && <div className="small text-secondary mt-2 text-break">{c.mediaUrl}</div>}
      </div>
    );
  }
  return <pre className="p-3 mb-0 small">{JSON.stringify(c, null, 2)}</pre>;
}

// ── Detail ──────────────────────────────────────────────────────────────────
function Detail({ id }) {
  const can = useCan();
  const nav = useNavigate();
  const { toast, showError } = useToast();
  const { data, loading } = useApi(() => api.get(`/reports/${id}`), [id]);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  const d = data?.data;
  if (!d) return null;
  const r = d.report;

  const ACTIONS = {
    dismiss: {
      title: 'Dismiss report', confirmText: 'Confirm', danger: false,
      body: 'The report is closed and nothing else happens.',
      payload: { status: 'dismissed', action: 'none' },
    },
    remove: {
      title: 'Remove the content', danger: true,
      body: 'The reported item stops showing in the app. The account stays active.',
      payload: { status: 'reviewed', action: 'content_removed', removeContent: true },
    },
    suspend: {
      title: 'Suspend the account', danger: true,
      body: 'The account is suspended and all their devices are signed out.',
      payload: { status: 'reviewed', action: 'account_suspended', blockUser: true },
    },
    both: {
      title: 'Remove content + suspend', danger: true,
      body: 'Both: the content is removed and the account is suspended.',
      payload: { status: 'reviewed', action: 'account_suspended', blockUser: true, removeContent: true },
    },
  };

  const act = async (v) => {
    const cfg = ACTIONS[dialog];
    setBusy(true);
    try {
      const out = await api.put(`/reports/${r._id}`, { ...cfg.payload, note: v.note });
      toast(out.message || 'Report updated');
      nav('/reports?status=pending');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const row = (k, v) => (
    <div className="row mb-1" key={k}>
      <dt className="col-5 text-secondary fw-normal small">{k}</dt>
      <dd className="col-7 mb-1">{v}</dd>
    </div>
  );

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <Link to="/reports" className="btn btn-sm btn-light"><i className="bi bi-arrow-left" /></Link>
        <h1 className="h4 mb-0">
          <Badge kind="dark">{r.reportType}</Badge> {r.reason}
        </h1>
        <StatusBadge status={r.status} />
      </div>

      {d.priorReports > 0 && (
        <div className="alert alert-warning py-2">
          There have already been <strong>{fmtNum(d.priorReports)}</strong>{' '}
          <Link to="/reports?status=all" className="alert-link">reports before</Link> —
          this does not look like a one-off.
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          <Card title="The reported item"><Content c={d.content} /></Card>
          {r.description && (
            <Card title="Reporter ne kya likha">
              <div className="p-3">{r.description}</div>
            </Card>
          )}
        </div>

        <div className="col-lg-5">
          <Card title="Report">
            <dl className="mb-0 p-3">
              {row('On what', r.reportedUser
                ? <Link to={`/users?id=${r.reportedUser._id}`}>
                    {r.reportedUser.name || r.reportedUser.mobile}
                  </Link>
                : '—')}
              {row('Reported by', r.reporter ? (r.reporter.name || r.reporter.mobile) : '—')}
              {row('Reason', r.reason)}
              {row('Status', <StatusBadge status={r.status} />)}
              {row('Action liya', r.action || 'none')}
              {row('Received', fmtDate(r.createdAt))}
              {row('Reviewed', r.reviewedAt ? fmtDate(r.reviewedAt) : '—')}
            </dl>
          </Card>

          {can('reports.act') && (
            <Card title="Action">
              <div className="p-3 d-grid gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setDialog('dismiss')}>
                  <i className="bi bi-x-circle" /> Nothing wrong — dismiss
                </button>
                <button className="btn btn-outline-danger" onClick={() => setDialog('remove')}>
                  <i className="bi bi-trash" /> Remove the content
                </button>
                <button className="btn btn-danger" onClick={() => setDialog('suspend')}>
                  <i className="bi bi-slash-circle" /> Suspend the account
                </button>
                <button className="btn btn-danger" onClick={() => setDialog('both')}>
                  <i className="bi bi-shield-x" /> Remove content + suspend
                </button>
              </div>
              <div className="px-3 pb-3 small text-secondary">
                A message is "removed", not erased — the app shows
                "This message was deleted" and the record stays.
              </div>
            </Card>
          )}
        </div>
      </div>

      {dialog && (
        <Modal title={ACTIONS[dialog].title} confirmText="Confirm"
               danger={ACTIONS[dialog].danger !== false} busy={busy}
               onClose={() => setDialog(null)} onSubmit={act}>
          <p>{ACTIONS[dialog].body}</p>
          <label className="form-label">Note <span className="text-danger">*</span></label>
          <input name="note" className="form-control" required placeholder="What you saw, what you did" />
          <div className="form-text">
            It goes to the audit log, and on a suspension the user sees this reason.
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Reports() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const id = params.get('id');
  return id ? <Detail id={id} /> : <Queue params={params} patch={patch} />;
}
