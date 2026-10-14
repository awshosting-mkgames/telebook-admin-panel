import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, Modal, Pager, Spinner, Stat, StatusBadge, Table,
  fmtDate, fmtNum, useToast,
} from '../ui/index.jsx';

const left = (endAt) => {
  const ms = new Date(endAt) - Date.now();
  if (ms <= 0) return 'khatam';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h ? `${h}h ${m}m bacha` : `${m}m bacha`;
};

export default function Boosts() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const can = useCan();
  const { toast, showError } = useToast();
  const [cancelling, setCancelling] = useState(null);
  const [busy, setBusy] = useState(false);

  const status = params.get('status') || 'active';
  const page = Number(params.get('page')) || 1;

  const { data, loading, reload } = useApi(
    async () => {
      const [boosts, settings] = await Promise.all([
        api.get('/boosts', { status, page, limit: 25 }),
        api.get('/settings').catch(() => null),
      ]);
      return { b: boosts.data, s: settings?.data?.settings };
    },
    [status, page]
  );

  const cancel = async (v) => {
    setBusy(true);
    try {
      const out = await api.post(`/boosts/${cancelling._id}/cancel`, {
        reason: v.reason, refund: v.refund === 'on',
      });
      toast(out.message || 'Boost cancelled');
      setCancelling(null);
      reload();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  if (loading) return <><h1 className="h4 mb-3">Boosts</h1><Spinner /></>;

  const b = data?.b;
  const f = data?.s?.features;
  const boostsOn = f ? (f.boosts !== false && f.coins !== false) : true;

  return (
    <>
      <h1 className="h4 mb-3">Boosts</h1>

      {!boostsOn && (
        <div className="alert alert-secondary">
          <strong>Boosts are switched off</strong> — "Sponsored" shows nowhere in the
          app and no new boost can be bought. Past records still show here.{' '}
          {can('settings.edit') && (
            <Link to="/settings?group=features" className="alert-link">See the switch</Link>
          )}
        </div>
      )}

      <div className="row g-3 mb-1">
        <Stat label="Kul boosts" value={fmtNum(b.totals.boosts)} col="col-6 col-lg-3" />
        <Stat label="Kul coins" value={fmtNum(b.totals.coinsSpent)} sub="spent on boosts"
              col="col-6 col-lg-3" />
      </div>

      <ul className="nav nav-pills mb-3 gap-1">
        {[['active', 'Chalu'], ['expired', 'Ends'], ['cancelled', 'Cancelled'], ['all', 'Sab']]
          .map(([v, label]) => (
            <li className="nav-item" key={v}>
              <Link className={`nav-link ${status === v ? 'active' : ''}`} to={`/boosts?status=${v}`}>
                {label}
              </Link>
            </li>
          ))}
      </ul>

      <Card>
        <Table columns={[
          { title: 'Channel', render: (x) => x.channel ? (
            <Link to={`/channels?q=${encodeURIComponent(x.channel.name)}`}
                  className="text-decoration-none fw-semibold">{x.channel.name}</Link>
          ) : <span className="text-secondary">(deleted channel)</span> },
          { title: 'Bought by', render: (x) => x.boughtBy ? (
            <>
              <Link to={`/users?id=${x.boughtBy._id}`} className="text-decoration-none small">
                {x.boughtBy.name || x.boughtBy.mobile}
              </Link>
              <div className="small text-secondary">{x.boughtBy.mobile}</div>
            </>
          ) : <span className="text-secondary">—</span> },
          { title: 'Duration', className: 'text-end', render: (x) => `${fmtNum(x.durationHours)}h` },
          { title: 'Coins', className: 'text-end', render: (x) => (
            <>
              {fmtNum(x.coins)}
              {x.refundedCoins > 0 && (
                <div className="small text-success">−{fmtNum(x.refundedCoins)} refund</div>
              )}
            </>
          ) },
          { title: 'Started', render: (x) => <span className="small text-secondary">{fmtDate(x.startAt)}</span> },
          { title: 'Ends', render: (x) => (
            <>
              <span className="small text-secondary">{fmtDate(x.endAt)}</span>
              {x.isRunning && <div className="small text-success">{left(x.endAt)}</div>}
            </>
          ) },
          { title: 'Status', render: (x) => x.isRunning
            ? <Badge kind="success">running</Badge>
            : <StatusBadge status={x.status} /> },
          { title: '', className: 'text-end', render: (x) =>
            (can('boosts.manage') && x.isRunning) ? (
              <button className="btn btn-sm btn-outline-danger" onClick={() => setCancelling(x)}>
                Cancel
              </button>
            ) : null },
        ]} rows={b.boosts}
           empty={status === 'active' ? 'No boost running right now' : 'No boosts found'} />
        <Pager pagination={b.pagination} onPage={(p) => patch({ status, page: p })} />
      </Card>

      {cancelling && (
        <Modal title="Cancel the boost" confirmText="Cancel boost" danger busy={busy}
               onClose={() => setCancelling(null)} onSubmit={cancel}>
          <p>The channel drops out of "Sponsored" immediately.</p>
          <div className="form-check mb-3">
            <input className="form-check-input" type="checkbox" name="refund" id="refund" defaultChecked />
            <label className="form-check-label" htmlFor="refund">Refund the unused time</label>
            <div className="form-text">
              {fmtNum(cancelling.coins)} coins were charged for {fmtNum(cancelling.durationHours)} hours
              — only the unused portion is refunded, not the whole amount.
            </div>
          </div>
          <label className="form-label">Reason <span className="text-danger">*</span></label>
          <input name="reason" className="form-control" required placeholder="why it was cancelled" />
        </Modal>
      )}
    </>
  );
}
