import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, ConfirmBox, Pager, Spinner, Table,
  fmtDate, fmtNum, useToast,
} from '../ui/index.jsx';

export default function Channels() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const can = useCan();
  const { toast, showError } = useToast();
  const [wiping, setWiping] = useState(null);
  const [faking, setFaking] = useState(null);
  const [busy, setBusy] = useState(false);

  const q = {
    q: params.get('q') || '',
    visibility: params.get('visibility') || '',
    boosted: params.get('boosted') || '',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };
  const { data, loading, reload } = useApi(() => api.get('/channels', q),
    [q.q, q.visibility, q.boosted, q.page]);

  const wipe = async (v) => {
    setBusy(true);
    try {
      const out = await api.post(`/channels/${wiping._id}/remove-posts`, { reason: v.reason });
      toast(out.message || 'Posts removed');
      setWiping(null);
      reload();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const saveFake = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    setBusy(true);
    try {
      const out = await api.put(`/channels/${faking._id}/fake-stats`, {
        fakeSubscribers: f.get('fakeSubscribers'),
        fakeViews: f.get('fakeViews'),
        reason: f.get('reason') || undefined,
      });
      toast(out.message || 'Saved');
      setFaking(null);
      reload();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h1 className="h4 mb-3">Channels</h1>

      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({ q: f.get('q'), visibility: f.get('visibility'),
                boosted: f.get('boosted') || '', page: 1 });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">Name</label>
            <input name="q" className="form-control" defaultValue={q.q} key={q.q}
                   placeholder="channel name" />
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Visibility</label>
            <select name="visibility" className="form-select" defaultValue={q.visibility} key={q.visibility}>
              <option value="">any</option>
              <option value="public">public</option>
              <option value="private">private</option>
            </select>
          </div>
          <div className="col-md-3 pb-2">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" name="boosted" value="true"
                     id="boostedOnly" defaultChecked={q.boosted === 'true'} key={q.boosted} />
              <label className="form-check-label small" htmlFor="boostedOnly">
                Sponsored (boosted) only
              </label>
            </div>
          </div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Apply</button></div>
        </div>
      </form>

      {loading ? <Spinner /> : (
        <Card>
          <Table columns={[
            { title: 'Channel', render: (c) => (
              <div className="d-flex align-items-center gap-2">
                {c.channelIcon
                  ? <img src={c.channelIcon} className="rounded" width="36" height="36" alt="" />
                  : (
                    <div className="rounded bg-light d-flex align-items-center justify-content-center"
                         style={{ width: 36, height: 36 }}>
                      <i className="bi bi-broadcast text-secondary" />
                    </div>
                  )}
                <div>
                  <div className="fw-semibold">
                    {c.channelName}
                    {c.isSponsored && <Badge kind="warning">Sponsored</Badge>}
                    {c.isPrivate && <Badge>private</Badge>}
                  </div>
                  {c.description && (
                    <div className="small text-secondary">
                      {c.description.slice(0, 60)}{c.description.length > 60 ? '…' : ''}
                    </div>
                  )}
                </div>
              </div>
            ) },
            { title: 'Category', render: (c) => c.category
              ? <Badge kind="light">{c.category}</Badge>
              : <span className="text-secondary">—</span> },
            { title: 'Subscribers', className: 'text-end', render: (c) => (
              <>
                {fmtNum(c.subscriberCount)}
                {(c.fakeSubscribers > 0 || c.fakeViews > 0) && (
                  <div className="small text-secondary">
                    real {fmtNum(c.realSubscriberCount)} · +{fmtNum(c.fakeSubscribers)} subs · +{fmtNum(c.fakeViews)} views/post
                  </div>
                )}
              </>
            ) },
            { title: 'Created by', render: (c) => c.creator ? (
              <Link to={`/users?id=${c.creator._id}`} className="text-decoration-none small">
                {c.creator.name || c.creator.mobile}
              </Link>
            ) : <span className="text-secondary">—</span> },
            { title: 'Boost', render: (c) => c.boostEndsAt
              ? <span className="small">till {fmtDate(c.boostEndsAt)}</span>
              : <span className="text-secondary small">—</span> },
            { title: 'Created', render: (c) => <span className="small text-secondary">{fmtDate(c.createdAt)}</span> },
            { title: '', className: 'text-end text-nowrap', render: (c) => (
              <>
                <Link to={`/boosts?status=all&channel=${c._id}`}
                      className="btn btn-sm btn-outline-secondary me-1">Boosts</Link>
                {can('channels.moderate') && (
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => setFaking(c)}>
                    Boost numbers
                  </button>
                )}
                {can('channels.moderate') && (
                  <button className="btn btn-sm btn-outline-danger" onClick={() => setWiping(c)}>
                    Remove posts
                  </button>
                )}
              </>
            ) },
          ]} rows={data?.data?.channels || []} empty="No channels found" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ page: p })} />
        </Card>
      )}

      {faking && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,.4)' }} onClick={() => !busy && setFaking(null)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <form className="modal-content" onSubmit={saveFake}>
              <div className="modal-header">
                <h5 className="modal-title">Boost numbers — {faking.channelName}</h5>
              </div>
              <div className="modal-body">
                <p className="small text-secondary">
                  Display-only numbers added on top of the real ones (real subscribers: {fmtNum(faking.realSubscriberCount)}).
                  Set 0 to remove.
                </p>
                <label className="form-label small mb-1">Fake subscribers</label>
                <input name="fakeSubscribers" type="number" min="0" step="1" className="form-control mb-3"
                       defaultValue={faking.fakeSubscribers || 0} required />
                <label className="form-label small mb-1">Fake views added to every post</label>
                <input name="fakeViews" type="number" min="0" step="1" className="form-control mb-3"
                       defaultValue={faking.fakeViews || 0} required />
                <label className="form-label small mb-1">Reason (optional, goes to audit log)</label>
                <input name="reason" className="form-control" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" disabled={busy} onClick={() => setFaking(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={busy}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {wiping && (
        <ConfirmBox
          title="Remove the channel's posts"
          message={<><strong>All</strong> posts in <strong>{wiping.channelName}</strong> stop
            showing in the app. The channel and its subscribers stay — only the
            posts are hidden, and the record remains.</>}
          confirmText="Remove posts" needReason busy={busy}
          onCancel={() => setWiping(null)} onConfirm={wipe}
        />
      )}
    </>
  );
}
