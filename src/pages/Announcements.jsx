import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, ConfirmBox, Modal, Pager, Spinner, Table,
  fmtDate, fmtNum, useToast,
} from '../ui/index.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  Announcements — one notice to every user
//
//  The app shows these as a banner. Sending the push is a SEPARATE action
//  (its own button, with a confirm): if every save pushed, every typo fix
//  would ring a hundred thousand phones.
// ─────────────────────────────────────────────────────────────────────────────

const KIND = { info: 'primary', success: 'success', warning: 'warning', critical: 'danger' };

const AUDIENCE_LABEL = {
  all: 'All users',
  plan: 'Subscribers only',
  free: 'Free users only',
};

const local = (v) => (v ? new Date(v).toISOString().slice(0, 16) : '');

function Form({ a = {} }) {
  return (
    <>
      <label className="form-label">Title <span className="text-danger">*</span></label>
      <input name="title" className="form-control mb-1" required maxLength={120}
             defaultValue={a.title || ''} />
      <div className="form-text mb-3">Shown in bold in the app. Keep it short.</div>

      <label className="form-label">Message <span className="text-danger">*</span></label>
      <textarea name="body" className="form-control mb-3" rows="4" required maxLength={4000}
                defaultValue={a.body || ''} />

      <div className="row g-2 mb-3">
        <div className="col-6">
          <label className="form-label small mb-1">Colour / kind</label>
          <select name="kind" className="form-select" defaultValue={a.kind || 'info'}>
            {Object.keys(KIND).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">Audience</label>
          <select name="audience" className="form-select" defaultValue={a.audience || 'all'}>
            {Object.entries(AUDIENCE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6">
          <label className="form-label small mb-1">Button label</label>
          <input name="actionLabel" className="form-control" maxLength={40}
                 defaultValue={a.actionLabel || ''} placeholder="e.g. 'See plans'" />
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">Button link</label>
          <input name="actionUrl" className="form-control" defaultValue={a.actionUrl || ''}
                 placeholder="https://… or an app deep link" />
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6">
          <label className="form-label small mb-1">From</label>
          <input name="startAt" type="datetime-local" className="form-control"
                 defaultValue={local(a.startAt)} />
          <div className="form-text">Empty = from now</div>
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">Until</label>
          <input name="endAt" type="datetime-local" className="form-control"
                 defaultValue={local(a.endAt)} />
          <div className="form-text">Empty = until switched off</div>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-6">
          <label className="form-label small mb-1">Priority</label>
          <input name="priority" type="number" className="form-control" defaultValue={a.priority ?? 0} />
          <div className="form-text">A higher number shows first</div>
        </div>
      </div>

      <div className="form-check">
        <input className="form-check-input" type="checkbox" name="dismissible" id="dismissible"
               defaultChecked={a.dismissible !== false} />
        <label className="form-check-label" htmlFor="dismissible">Users can dismiss it</label>
        <div className="form-text">
          Keep notices that cannot be dismissed for things that really matter.
        </div>
      </div>
      <div className="form-check">
        <input className="form-check-input" type="checkbox" name="isActive" id="annActive"
               defaultChecked={a.isActive !== false} />
        <label className="form-check-label" htmlFor="annActive">Running</label>
      </div>
    </>
  );
}

const readForm = (v) => ({
  title: v.title,
  body: v.body,
  kind: v.kind,
  audience: v.audience,
  actionLabel: v.actionLabel || null,
  actionUrl: v.actionUrl || null,
  startAt: v.startAt ? new Date(v.startAt).toISOString() : undefined,
  endAt: v.endAt ? new Date(v.endAt).toISOString() : null,
  priority: Number(v.priority) || 0,
  dismissible: v.dismissible === 'on',
  isActive: v.isActive === 'on',
});

export default function Announcements() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const { toast, showError } = useToast();
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const status = params.get('status') || 'all';
  const page = Number(params.get('page')) || 1;

  const { data, loading, reload } = useApi(
    () => api.get('/announcements', { ...(status !== 'all' ? { status } : {}), page, limit: 25 }),
    [status, page]
  );

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { const out = await fn(); toast(out?.message || okMsg); setDialog(null); reload(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h4 mb-0">Announcements</h1>
        <button className="btn btn-sm btn-primary ms-auto" onClick={() => setDialog({ kind: 'new' })}>
          <i className="bi bi-megaphone" /> New announcement
        </button>
      </div>

      <p className="text-secondary small">
        These show as a banner in the app — they never go into a chat.{' '}
        {data?.data?.liveCount
          ? <><strong>{fmtNum(data.data.liveCount)}</strong> live right now.</>
          : 'None are live right now.'}
      </p>

      <ul className="nav nav-pills mb-3 gap-1">
        {[['all', 'Sab'], ['live', 'Active now'], ['scheduled', 'Scheduled'],
          ['expired', 'Ends'], ['inactive', 'Switched off']].map(([v, l]) => (
          <li className="nav-item" key={v}>
            <Link className={`nav-link ${status === v ? 'active' : ''}`}
                  to={`/announcements?status=${v}`}>{l}</Link>
          </li>
        ))}
      </ul>

      {loading ? <Spinner /> : (
        <Card>
          <Table columns={[
            { title: 'Announcement', render: (a) => (
              <>
                <div className="fw-semibold">
                  {a.title}
                  <Badge kind={KIND[a.kind] || 'secondary'}>{a.kind}</Badge>
                  {a.isLive && <Badge kind="success">abhi dikh rahi</Badge>}
                </div>
                <div className="small text-secondary" style={{ maxWidth: 420 }}>
                  {String(a.body).slice(0, 110)}{a.body.length > 110 ? '…' : ''}
                </div>
                {a.actionLabel && (
                  <div className="small"><i className="bi bi-link-45deg" /> {a.actionLabel}</div>
                )}
              </>
            ) },
            { title: 'Audience', render: (a) => (
              <>
                {AUDIENCE_LABEL[a.audience] || a.audience}
                {a.planCodes?.length > 0 && (
                  <div className="small text-secondary">{a.planCodes.join(', ')}</div>
                )}
              </>
            ) },
            { title: 'From / until', render: (a) => (
              <>
                <div className="small">{fmtDate(a.startAt)}</div>
                <div className="small text-secondary">
                  {a.endAt ? fmtDate(a.endAt) : 'no end date'}
                </div>
              </>
            ) },
            { title: 'Seen', className: 'text-end', render: (a) => (
              <>
                {fmtNum(a.seenCount)}
                <div className="small text-secondary">{fmtNum(a.dismissedCount)} ne band ki</div>
              </>
            ) },
            { title: 'Push', render: (a) => a.pushedAt ? (
              <>
                <span className="small text-success">bhej diya</span>
                <div className="small text-secondary">{fmtDate(a.pushedAt)}</div>
              </>
            ) : <span className="small text-secondary">not sent</span> },
            { title: '', className: 'text-end', render: (a) => (
              <div className="btn-group btn-group-sm">
                <button className="btn btn-outline-secondary"
                        onClick={() => setDialog({ kind: 'edit', a })}>Edit</button>
                {a.isLive && (
                  <button className="btn btn-outline-primary"
                          onClick={() => setDialog({ kind: 'push', a })}>Push</button>
                )}
                <button className="btn btn-outline-danger"
                        onClick={() => setDialog({ kind: 'del', a })}>
                  <i className="bi bi-trash" />
                </button>
              </div>
            ) },
          ]} rows={data?.data?.announcements || []} empty="No announcements" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ status, page: p })} />
        </Card>
      )}

      {dialog?.kind === 'new' && (
        <Modal title="New announcement" confirmText="Create" busy={busy} size="modal-lg"
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(
                 () => api.post('/announcements', readForm(v)),
                 'Announcement created — it appears in the app within a minute'
               )}>
          <Form />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title="Edit announcement" confirmText="Save" busy={busy} size="modal-lg"
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(
                 () => api.put(`/announcements/${dialog.a._id}`, readForm(v)),
                 'Updated'
               )}>
          <Form a={dialog.a} />
        </Modal>
      )}

      {dialog?.kind === 'push' && (
        <ConfirmBox
          title="Send push"
          message={
            <>
              <p>A notification for <strong>{dialog.a.title}</strong> goes to the
                phone of every user who has notifications on.</p>
              {dialog.a.pushedAt && (
                <p className="text-danger mb-0">
                  A push for this notice <strong>has already been sent</strong> —
                  sending again means people get it twice.
                </p>
              )}
              <p className="mb-0 small text-secondary">A push cannot be recalled.</p>
            </>
          }
          confirmText="Yes, send it" busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => act(
            () => api.post(`/announcements/${dialog.a._id}/push`, { confirm: true }),
            'Push sent'
          )}
        />
      )}

      {dialog?.kind === 'del' && (
        <ConfirmBox
          title="Delete announcement"
          message={<><strong>{dialog.a.title}</strong> is removed entirely.
            To merely hide it from the app, switching "Active" off is enough.</>}
          confirmText="Delete" busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => act(() => api.del(`/announcements/${dialog.a._id}`), 'Deleted')}
        />
      )}
    </>
  );
}
