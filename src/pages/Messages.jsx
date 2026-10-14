import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, store, url } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, Modal, Pager, Spinner, Table,
  fmtDate, fmtNum, useToast,
} from '../ui/index.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  Chats & messages
//
//  The most sensitive page in the panel — people's PRIVATE conversations are
//  read here. So two things are deliberate:
//
//   • No message text appears when the page opens. First the chat list and
//     counts; the text arrives only when you open a chat.
//   • Every open and every export is written to the audit log, and the page
//     says so — so it stays in mind.
// ─────────────────────────────────────────────────────────────────────────────

const PrivacyNote = () => (
  <div className="alert alert-secondary d-flex align-items-start gap-2 py-2">
    <i className="bi bi-shield-lock mt-1" />
    <div className="small">
      These are people's private conversations. Every chat you open or export is
      recorded under your name in the{' '}
      <Link to="/audit?action=messages.view" className="alert-link">audit log</Link>.
      Messages are stored encrypted; they are decrypted only for this screen.
    </div>
  </div>
);

const chatTitle = (c) => c.isGroupChat
  ? (c.chatName || 'Group')
  : (c.users || []).map((u) => u.name || u.mobile).join(' ↔ ') || '—';

// ── Export ──────────────────────────────────────────────────────────────────
//
//  The download goes through `fetch` (the token has to be a header), so we
//  build a blob and click a hidden link. api.js is no use here: it treats
//  every response as JSON, and an export is a FILE.
export function ExportDialog({ userId, chatId, label, onClose }) {
  const { toast, showError } = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (v) => {
    const params = new URLSearchParams({
      format: v.format,
      ...(chatId ? { chatId } : {}),
      ...(v.includeDeleted === 'on' ? { includeDeleted: 'true' } : {}),
      reason: v.reason,
    });

    setBusy(true);
    toast('Preparing the export…', 'info');
    try {
      const r = await fetch(`${url(`/users/${userId}/export`)}?${params}`, {
        headers: { Authorization: `Bearer ${store.token}` },
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.message || `Export fail (${r.status})`);
      }

      const blob = await r.blob();
      const name = (r.headers.get('content-disposition') || '')
        .match(/filename="([^"]+)"/)?.[1] || `telebook-export.${v.format}`;

      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(href);

      toast(`${name} download ho gaya`);
      onClose();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={chatId ? 'Export this chat' : 'Export all chats'}
           confirmText="Export" busy={busy} onClose={onClose} onSubmit={run}>
      <div className="alert alert-warning py-2 small">
        {chatId
          ? <>The whole of <strong>{label || 'This chat'}</strong> goes into a file.</>
          : <><strong>All</strong> of this user's chats go into a file.</>}
        {' '}This is recorded in the audit log under your name.
      </div>
      <label className="form-label">File format</label>
      <select name="format" className="form-select mb-3">
        <option value="json">JSON — the full data, for loading into another system</option>
        <option value="txt">Text — for reading</option>
      </select>
      <div className="form-check mb-3">
        <input className="form-check-input" type="checkbox" name="includeDeleted" id="incDel" />
        <label className="form-check-label small" htmlFor="incDel">
          Include deleted messages
        </label>
      </div>
      <label className="form-label">Why <span className="text-danger">*</span></label>
      <input name="reason" className="form-control" required placeholder="e.g. 'police request #1234'" />
      <div className="form-text">Written to the audit log.</div>
    </Modal>
  );
}

// ── Chat list ───────────────────────────────────────────────────────────────
function ChatList({ params, patch }) {
  const q = {
    q: params.get('q') || '',
    type: params.get('type') || '',
    userId: params.get('userId') || '',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };
  const { data, loading } = useApi(() => api.get('/chats', q), [q.q, q.type, q.userId, q.page]);

  return (
    <>
      <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h4 mb-0">Chats</h1>
        <Link to="/messages?view=search" className="btn btn-sm btn-outline-secondary ms-auto">
          <i className="bi bi-search" /> Message search
        </Link>
      </div>
      <PrivacyNote />

      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({ q: f.get('q'), type: f.get('type'), userId: f.get('userId'), page: 1 });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">Group name</label>
            <input name="q" className="form-control" defaultValue={q.q} key={q.q}
                   placeholder="group chats only" />
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Type</label>
            <select name="type" className="form-select" defaultValue={q.type} key={q.type}>
              <option value="">all</option>
              <option value="direct">one-to-one</option>
              <option value="group">group</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">User ID</label>
            <input name="userId" className="form-control" defaultValue={q.userId} key={q.userId}
                   placeholder="this user's chats" />
          </div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Apply</button></div>
        </div>
      </form>

      {loading ? <Spinner /> : (
        <Card>
          <Table columns={[
            { title: 'Chat', render: (c) => (
              <>
                <div className="fw-semibold">
                  {chatTitle(c)}
                  {c.isGroupChat && <Badge kind="light">{c.users.length} members</Badge>}
                </div>
                {c.groupAdmin && (
                  <div className="small text-secondary">
                    admin: {c.groupAdmin.name || c.groupAdmin.mobile}
                  </div>
                )}
              </>
            ) },
            { title: 'Messages', className: 'text-end', render: (c) => fmtNum(c.messageCount) },
            { title: 'Last message', render: (c) => (
              <span className="small text-secondary">{fmtDate(c.lastMessageAt)}</span>
            ) },
            { title: 'Created', render: (c) => (
              <span className="small text-secondary">{fmtDate(c.createdAt)}</span>
            ) },
            { title: '', className: 'text-end', render: (c) => (
              <Link to={`/messages?chatId=${c._id}`} className="btn btn-sm btn-outline-secondary">
                Kholo
              </Link>
            ) },
          ]} rows={data?.data?.chats || []} empty="No chats found" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ page: p })} />
        </Card>
      )}
    </>
  );
}

// ── Ek chat ─────────────────────────────────────────────────────────────────
function Bubble({ m, leftId }) {
  const mine = String(m.sender?._id || '') === String(leftId);
  const who = m.sender ? (m.sender.name || m.sender.mobile) : 'Unknown';

  let body;
  if (m.isDeleted) {
    body = <em className="text-secondary">(hata diya gaya)</em>;
  } else if (m.messageType === 'location' && m.location) {
    body = (
      <>
        <i className="bi bi-geo-alt" /> {m.location.name || ''}
        <div className="small text-secondary">{m.location.latitude}, {m.location.longitude}</div>
      </>
    );
  } else if (m.messageType === 'contact' && m.contactCard) {
    body = (
      <>
        <i className="bi bi-person-vcard" /> {m.contactCard.name || ''}
        <div className="small text-secondary">{m.contactCard.mobile || ''}</div>
      </>
    );
  } else {
    body = (
      <>
        {m.content || ''}
        {m.attachments?.length > 0 && (
          <div className="small text-secondary mt-1">
            <i className="bi bi-paperclip" /> {m.attachments.map((a) => a.filename || a.key).join(', ')}
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`d-flex mb-2 ${mine ? 'justify-content-end' : ''}`}>
      <div className={`rounded px-3 py-2 ${mine ? 'bg-primary-subtle' : 'bg-light'}`}
           style={{ maxWidth: '75%' }}>
        <div className="small text-secondary">
          {who} · {fmtDate(m.createdAt)}
          {m.isEdited && <Badge kind="light">edited</Badge>}
          {m.isForwarded && <Badge kind="light">forwarded</Badge>}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</div>
      </div>
    </div>
  );
}

function ChatDetail({ chatId, params, patch }) {
  const can = useCan();
  const [exporting, setExporting] = useState(false);
  const threadRef = useRef(null);
  const search = params.get('search') || '';
  const page = Number(params.get('page')) || 1;

  const { data, loading } = useApi(
    () => api.get(`/chats/${chatId}/messages`, { page, limit: 100, ...(search ? { search } : {}) }),
    [chatId, search, page]
  );

  // Opening a page jumps to the bottom (the latest message)
  useEffect(() => {
    if (!loading && !search && page === 1 && threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [loading, search, page]);

  if (loading) return <Spinner />;
  const d = data?.data;
  if (!d) return null;
  const c = d.chat;
  const leftId = c.users?.[0]?._id;

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <Link to="/messages" className="btn btn-sm btn-light"><i className="bi bi-arrow-left" /></Link>
        <h1 className="h5 mb-0">{chatTitle(c)}</h1>
        {c.isGroupChat ? <Badge kind="dark">group</Badge> : <Badge>direct</Badge>}
        <span className="text-secondary small">{fmtNum(d.pagination.total)} messages</span>
        {can('messages.export') && c.users?.[0] && (
          <button className="btn btn-sm btn-outline-primary ms-auto" onClick={() => setExporting(true)}>
            <i className="bi bi-download" /> Export this chat
          </button>
        )}
      </div>

      <div className="mb-2 small text-secondary">
        {(c.users || []).map((u, i) => (
          <span key={u._id}>
            {i > 0 && ' · '}
            <Link to={`/users?id=${u._id}`} className="text-decoration-none">{u.name || u.mobile}</Link>
          </span>
        ))}
      </div>

      <form className="row g-2 mb-3" onSubmit={(e) => {
        e.preventDefault();
        patch({ search: new FormData(e.target).get('search'), page: 1 });
      }}>
        <div className="col-md-6">
          <input name="search" className="form-control form-control-sm"
                 defaultValue={search} key={search} placeholder="Search in this chat" />
        </div>
        <div className="col-auto"><button className="btn btn-sm btn-primary">Search</button></div>
        {search && (
          <div className="col-auto">
            <Link to={`/messages?chatId=${chatId}`} className="btn btn-sm btn-light">Clear</Link>
          </div>
        )}
      </form>

      <div className="card shadow-sm">
        <div className="card-body tb-thread" ref={threadRef}>
          {d.messages.length
            ? d.messages.map((m) => <Bubble key={m._id} m={m} leftId={leftId} />)
            : <div className="text-center text-secondary py-5">No messages</div>}
        </div>
      </div>
      <Pager pagination={d.pagination} onPage={(p) => patch({ page: p })} />

      {exporting && (
        <ExportDialog userId={c.users[0]._id} chatId={chatId} label={chatTitle(c)}
                      onClose={() => setExporting(false)} />
      )}
    </>
  );
}

// ── Global search ───────────────────────────────────────────────────────────
function MessageSearch({ params, patch }) {
  const q = {
    q: params.get('q') || '',
    userId: params.get('userId') || '',
    type: params.get('type') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };

  // With no filter the server answers 400 — ask first, then send
  const empty = !q.q && !q.userId && !q.type && !q.from && !q.to;
  const { data, loading } = useApi(() => api.get('/messages', q),
    [q.q, q.userId, q.type, q.from, q.to, q.page], { skip: empty });

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-3">
        <Link to="/messages" className="btn btn-sm btn-light"><i className="bi bi-arrow-left" /></Link>
        <h1 className="h4 mb-0">Message search</h1>
      </div>
      <PrivacyNote />

      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({
          view: 'search', q: f.get('q'), userId: f.get('userId'), type: f.get('type'),
          from: f.get('from'), to: f.get('to'), page: 1,
        });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">Text</label>
            <input name="q" className="form-control" defaultValue={q.q} key={q.q}
                   placeholder="whole word or its start" />
            <div className="form-text">
              Messages are encrypted — a whole word or the start of one works,
              the middle of a word does not.
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Sender (user ID)</label>
            <input name="userId" className="form-control" defaultValue={q.userId} key={q.userId} />
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Type</label>
            <select name="type" className="form-select" defaultValue={q.type} key={q.type}>
              <option value="">all</option>
              {['text', 'image', 'video', 'audio', 'document', 'location', 'contact']
                .map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-3 row g-1">
            <div className="col-6">
              <label className="form-label small mb-1">From</label>
              <input name="from" type="date" className="form-control" defaultValue={q.from} key={q.from} />
            </div>
            <div className="col-6">
              <label className="form-label small mb-1">To</label>
              <input name="to" type="date" className="form-control" defaultValue={q.to} key={q.to} />
            </div>
          </div>
          <div className="col-12"><button className="btn btn-primary">Search</button></div>
        </div>
      </form>

      {empty ? (
        <Card>
          <div className="text-center text-secondary py-5">
            Kuch to chuniye — text, user, tarah ya tareekh.<br />
            <span className="small">The whole database is not opened at once.</span>
          </div>
        </Card>
      ) : loading ? <Spinner /> : (
        <Card title={`${fmtNum(data?.data?.pagination?.total)} mile`}>
          <Table columns={[
            { title: 'When', render: (m) => <span className="small text-secondary">{fmtDate(m.createdAt)}</span> },
            { title: 'By', render: (m) => m.sender ? (
              <Link to={`/users?id=${m.sender._id}`} className="text-decoration-none small">
                {m.sender.name || m.sender.mobile}
              </Link>
            ) : <span className="text-secondary">—</span> },
            { title: 'Chat', render: (m) => m.chat ? (
              <Link to={`/messages?chatId=${m.chat._id}`} className="text-decoration-none small">
                {m.chat.chatName || '—'}
              </Link>
            ) : <span className="text-secondary">—</span> },
            { title: 'Message', render: (m) => m.isDeleted
              ? <em className="text-secondary">(hata diya gaya)</em>
              : (
                <>
                  <span style={{ whiteSpace: 'pre-wrap' }}>
                    {String(m.content || '').slice(0, 160)}
                    {(m.content || '').length > 160 ? '…' : ''}
                  </span>
                  {m.messageType !== 'text' && <Badge kind="dark">{m.messageType}</Badge>}
                </>
              ) },
          ]} rows={data?.data?.messages || []} empty="Nothing found" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ page: p })} />
        </Card>
      )}
    </>
  );
}

export default function Messages() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const chatId = params.get('chatId');

  if (chatId) return <ChatDetail chatId={chatId} params={params} patch={patch} />;
  if (params.get('view') === 'search') return <MessageSearch params={params} patch={patch} />;
  return <ChatList params={params} patch={patch} />;
}
