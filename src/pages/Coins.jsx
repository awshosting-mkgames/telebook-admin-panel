import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, Modal, Pager, Spinner, StatusBadge, Table,
  fmtDate, fmtNum, useToast,
} from '../ui/index.jsx';

const TABS = { wallets: 'Wallets', ledger: 'Ledger', packs: 'Coin packs', rates: 'Rates' };

// ── Wallets ─────────────────────────────────────────────────────────────────
function Wallets({ params, patch }) {
  const can = useCan();
  const page = Number(params.get('page')) || 1;
  const { data, loading } = useApi(() => api.get('/coins/wallets', { page, limit: 25 }), [page]);
  if (loading) return <Spinner />;

  return (
    <Card title="Wallets (largest first)">
      <Table columns={[
        { title: 'User', render: (w) => w.user ? (
          <>
            <Link to={`/users?id=${w.user._id}`} className="text-decoration-none fw-semibold">
              {w.user.name || '—'}
            </Link>
            <div className="small text-secondary">{w.user.mobile}</div>
          </>
        ) : <span className="text-secondary">(deleted user)</span> },
        { title: 'Balance', className: 'text-end',
          render: (w) => <span className="fs-5 fw-semibold">{fmtNum(w.balance)}</span> },
        { title: 'Kul aaye', className: 'text-end', render: (w) => fmtNum(w.totalCredited) },
        { title: 'Kul gaye', className: 'text-end', render: (w) => fmtNum(w.totalDebited) },
        { title: 'Last activity', render: (w) => <span className="small text-secondary">{fmtDate(w.lastTxAt)}</span> },
        { title: '', className: 'text-end', render: (w) => w.user && can('coins.view') && (
          <Link to={`/coins?tab=ledger&userId=${w.user._id}`} className="btn btn-sm btn-outline-secondary">
            Ledger
          </Link>
        ) },
      ]} rows={data?.data?.wallets || []}
         rowKey={(w) => w.user?._id || Math.random()}
         empty="No wallets yet" />
      <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ tab: 'wallets', page: p })} />
    </Card>
  );
}

// ── Ledger ──────────────────────────────────────────────────────────────────
function Ledger({ params, patch }) {
  const q = {
    userId: params.get('userId') || '',
    type: params.get('type') || '',
    reason: params.get('reason') || '',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };
  const { data, loading } = useApi(() => api.get('/coins/transactions', q),
    [q.userId, q.type, q.reason, q.page]);

  return (
    <>
      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({ tab: 'ledger', userId: f.get('userId'), type: f.get('type'), reason: f.get('reason'), page: 1 });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">User ID</label>
            <input name="userId" className="form-control" defaultValue={q.userId} key={q.userId}
                   placeholder="empty = all" />
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Type</label>
            <select name="type" className="form-select" defaultValue={q.type} key={q.type}>
              <option value="">any</option>
              <option value="credit">credit</option>
              <option value="debit">debit</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Reason</label>
            <select name="reason" className="form-select" defaultValue={q.reason} key={q.reason}>
              <option value="">any</option>
              {['purchase', 'call', 'boost', 'refund', 'bonus', 'admin_credit', 'admin_debit']
                .map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Apply</button></div>
        </div>
      </form>

      {loading ? <Spinner /> : (
        <Card title="Coin ledger (cannot be altered)">
          <Table columns={[
            { title: 'When', render: (t) => <span className="small text-secondary">{fmtDate(t.createdAt)}</span> },
            { title: 'User', render: (t) => t.user ? (
              <Link to={`/users?id=${t.user._id}`} className="text-decoration-none">
                {t.user.name || t.user.mobile}
              </Link>
            ) : <span className="text-secondary">—</span> },
            { title: 'Amount', className: 'text-end', render: (t) => t.type === 'credit'
              ? <span className="text-success fw-semibold">+{fmtNum(t.amount)}</span>
              : <span className="text-danger fw-semibold">−{fmtNum(t.amount)}</span> },
            { title: 'Balance after', className: 'text-end', render: (t) => fmtNum(t.balanceAfter) },
            { title: 'Reason', render: (t) => (
              <>
                <Badge kind="dark">{t.reason}</Badge>
                {t.description && <div className="small text-secondary">{t.description}</div>}
                {t.reasonText && <div className="small">{t.reasonText}</div>}
              </>
            ) },
            { title: 'By', render: (t) => t.createdByName
              ? <span className="small">{t.createdByName}</span>
              : <span className="text-secondary small">system</span> },
            { title: 'Status', render: (t) => <StatusBadge status={t.status} /> },
          ]} rows={data?.data?.transactions || []} empty="No transactions" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ tab: 'ledger', page: p })} />
        </Card>
      )}
    </>
  );
}

// ── Coin packs ──────────────────────────────────────────────────────────────
function Packs() {
  const can = useCan();
  const { toast, showError } = useToast();
  const { data, loading } = useApi(() => api.get('/settings'), []);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);

  // Take a local copy once it arrives — editing should not hit the server
  // on every keystroke
  useEffect(() => {
    if (data) setList((data.data.settings.coins?.packs || []).map((p) => ({ ...p })));
  }, [data]);

  if (loading || !list) return <Spinner />;

  const update = (i, field, value) => {
    setList((l) => l.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const save = async () => {
    if (!list.length) return showError(new Error('At least one pack is required'));
    setBusy(true);
    try {
      const out = await api.put('/coins/packs', { packs: list });
      toast(out.message || 'Packs saved');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <Card title="Coin packs">
      <div className="p-3">
        <p className="small text-secondary">
          These are the packs on the app's "buy coins" screen. With Play Billing on,
          each pack's <code>playProductId</code> must exist in the Play Console —
          otherwise that pack cannot be bought in the app.
        </p>
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>ID</th><th className="text-end">Coins</th><th className="text-end">Price</th>
                <th>Play product ID</th><th className="text-center">Active</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={i}>
                  <td><input className="form-control form-control-sm" value={p.id}
                             onChange={(e) => update(i, 'id', e.target.value)} /></td>
                  <td><input className="form-control form-control-sm text-end" type="number" value={p.coins}
                             onChange={(e) => update(i, 'coins', Number(e.target.value))} /></td>
                  <td><input className="form-control form-control-sm text-end" type="number" value={p.price}
                             onChange={(e) => update(i, 'price', Number(e.target.value))} /></td>
                  <td><input className="form-control form-control-sm" value={p.playProductId || ''}
                             onChange={(e) => update(i, 'playProductId', e.target.value)} /></td>
                  <td className="text-center">
                    <input className="form-check-input" type="checkbox" checked={p.isActive !== false}
                           onChange={(e) => update(i, 'isActive', e.target.checked)} />
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-danger"
                            onClick={() => setList((l) => l.filter((_, x) => x !== i))}>
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary"
                  onClick={() => setList((l) => [...l, {
                    id: `pack_${l.length + 1}`, coins: 100, price: 99, playProductId: '', isActive: true,
                  }])}>
            <i className="bi bi-plus-lg" /> Add pack
          </button>
          {can('coins.config') && (
            <button className="btn btn-sm btn-primary ms-auto" onClick={save} disabled={busy}>
              {busy && <span className="spinner-border spinner-border-sm me-2" />}Save packs
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Rates ───────────────────────────────────────────────────────────────────
function Rates() {
  const can = useCan();
  const { toast, showError } = useToast();
  const { data, loading } = useApi(() => api.get('/settings'), []);
  const [form, setForm] = useState(null);
  const [boosts, setBoosts] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const c = data.data.settings.calls || {};
    setForm({
      billingUnit: c.billingUnit === 'second' ? 'second' : 'minute',
      audioCoinsPerUnit: c.audioCoinsPerUnit ?? 1,
      videoCoinsPerUnit: c.videoCoinsPerUnit ?? 2,
      minUnitsToStart: c.minUnitsToStart ?? 1,
      warnAtSeconds: c.warnAtSeconds ?? 30,
    });
    setBoosts((data.data.settings.boosts?.options || []).map((o) => ({ ...o })));
  }, [data]);

  if (loading || !form) return <Spinner />;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // "How much talk does 100 coins buy" — answered here, no mental arithmetic
  const sec = form.billingUnit === 'second' ? 1 : 60;
  const talk = (per) => {
    const p = Math.max(0, Number(per) || 0);
    if (!p) return 'free';
    return `${Math.floor((100 / p) * sec / 60)} minutes`;
  };

  const saveRates = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await api.put('/coins/rates', {
        billingUnit: form.billingUnit,
        audioCoinsPerUnit: Number(form.audioCoinsPerUnit),
        videoCoinsPerUnit: Number(form.videoCoinsPerUnit),
        minUnitsToStart: Number(form.minUnitsToStart),
        warnAtSeconds: Number(form.warnAtSeconds),
      });
      toast(out.message || 'Rates updated');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const saveBoosts = async () => {
    setBusy(true);
    try {
      const out = await api.put('/coins/rates', { boostOptions: boosts });
      toast(out.message || 'Boost options saved');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <div className="row g-3">
      <div className="col-lg-6">
        <Card title="Call pricing">
          <form className="p-3" onSubmit={saveRates}>
            <div className="alert alert-info py-2 small mb-3">
              The <strong>unit</strong> decides how long one charge covers. On
              <code>minute</code>, 1 coin = 1 minute; on <code>second</code>,
              1 coin = 1 second. A started unit is charged <strong>in full</strong> —
              a 3-second call still costs a minute under minute billing. Calls already
              running are unaffected: the rate is fixed when the call is accepted.
            </div>

            <label className="form-label">Billing unit</label>
            <select className="form-select mb-3" value={form.billingUnit}
                    onChange={(e) => set('billingUnit', e.target.value)}>
              <option value="minute">minute (1 coin = 1 min)</option>
              <option value="second">second (1 coin = 1 sec)</option>
            </select>

            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label small mb-1">Audio — coins per {form.billingUnit}</label>
                <input type="number" min="0" className="form-control" value={form.audioCoinsPerUnit}
                       onChange={(e) => set('audioCoinsPerUnit', e.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label small mb-1">Video — coins per {form.billingUnit}</label>
                <input type="number" min="0" className="form-control" value={form.videoCoinsPerUnit}
                       onChange={(e) => set('videoCoinsPerUnit', e.target.value)} />
              </div>
              <div className="col-6">
                <label className="form-label small mb-1">Units needed to start</label>
                <input type="number" min="0" className="form-control" value={form.minUnitsToStart}
                       onChange={(e) => set('minUnitsToStart', e.target.value)} />
                <div className="form-text">Without coins for this many units, the call never starts.</div>
              </div>
              <div className="col-6">
                <label className="form-label small mb-1">Warning (seconds before)</label>
                <input type="number" min="0" className="form-control" value={form.warnAtSeconds}
                       onChange={(e) => set('warnAtSeconds', e.target.value)} />
                <div className="form-text">The user is warned when this much time is left.</div>
              </div>
            </div>

            <div className="bg-light rounded p-3 mb-3 small">
              <strong>100 coins buys:</strong> audio ≈ {talk(form.audioCoinsPerUnit)},
              video ≈ {talk(form.videoCoinsPerUnit)}
              <div className="text-secondary mt-1">
                A started {form.billingUnit} is charged in full.
              </div>
            </div>

            {can('coins.config') && (
              <button className="btn btn-primary" disabled={busy}>
                {busy && <span className="spinner-border spinner-border-sm me-2" />}Save rates
              </button>
            )}
          </form>
        </Card>
      </div>

      <div className="col-lg-6">
        <Card title="Channel boost pricing">
          <div className="p-3">
            <p className="small text-secondary">
              A user spends coins to put their channel in "Sponsored" — like a
              sponsored result on Google. Each option is a duration and a price.
            </p>
            <table className="table table-sm align-middle">
              <thead>
                <tr><th>ID</th><th className="text-end">Hours</th><th className="text-end">Coins</th><th></th></tr>
              </thead>
              <tbody>
                {(boosts || []).map((o, i) => (
                  <tr key={i}>
                    <td><input className="form-control form-control-sm" value={o.id}
                               onChange={(e) => setBoosts((b) => b.map((x, idx) => idx === i ? { ...x, id: e.target.value } : x))} /></td>
                    <td><input className="form-control form-control-sm text-end" type="number" value={o.hours}
                               onChange={(e) => setBoosts((b) => b.map((x, idx) => idx === i ? { ...x, hours: Number(e.target.value) } : x))} /></td>
                    <td><input className="form-control form-control-sm text-end" type="number" value={o.coins}
                               onChange={(e) => setBoosts((b) => b.map((x, idx) => idx === i ? { ...x, coins: Number(e.target.value) } : x))} /></td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-danger"
                              onClick={() => setBoosts((b) => b.filter((_, x) => x !== i))}>
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary"
                      onClick={() => setBoosts((b) => [...b, { id: `boost_${b.length + 1}`, hours: 1, coins: 100 }])}>
                <i className="bi bi-plus-lg" /> Add option
              </button>
              {can('coins.config') && (
                <button className="btn btn-sm btn-primary ms-auto" onClick={saveBoosts} disabled={busy}>
                  Save options
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Coins() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const can = useCan();
  const { toast, showError } = useToast();
  const [adjusting, setAdjusting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'wallets';

  const adjust = async (v) => {
    setBusy(true);
    try {
      const found = await api.get('/users', { q: v.mobile, limit: 5 });
      const user = (found.data.users || []).find((u) => u.mobile === v.mobile.trim())
        || found.data.users?.[0];
      if (!user) throw new Error(`No user found for ${v.mobile}`);

      const out = await api.post('/coins/adjust', {
        userId: user._id, amount: Number(v.amount),
        direction: v.direction, reason: v.reason,
      });
      toast(out.message || 'Done');
      setAdjusting(false);
      setNonce((n) => n + 1);     // list dobara load ho
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h4 mb-0">Coins</h1>
        {can('coins.adjust') && (
          <button className="btn btn-sm btn-primary ms-auto" onClick={() => setAdjusting(true)}>
            <i className="bi bi-plus-slash-minus" /> Adjust coins
          </button>
        )}
      </div>

      <ul className="nav nav-tabs mb-3">
        {Object.entries(TABS).map(([k, label]) => (
          <li className="nav-item" key={k}>
            <Link className={`nav-link ${tab === k ? 'active' : ''}`} to={`/coins?tab=${k}`}>{label}</Link>
          </li>
        ))}
      </ul>

      <div key={`${tab}-${nonce}`}>
        {tab === 'wallets' && <Wallets params={params} patch={patch} />}
        {tab === 'ledger'  && <Ledger params={params} patch={patch} />}
        {tab === 'packs'   && <Packs />}
        {tab === 'rates'   && <Rates />}
      </div>

      {adjusting && (
        <Modal title="Adjust coins" confirmText="Apply" busy={busy}
               onClose={() => setAdjusting(false)} onSubmit={adjust}>
          <label className="form-label">User's mobile <span className="text-danger">*</span></label>
          <input name="mobile" className="form-control mb-3" required placeholder="+919876543210" />
          <label className="form-label">Direction</label>
          <select name="direction" className="form-select mb-3">
            <option value="credit">Add coins</option>
            <option value="debit">Remove coins</option>
          </select>
          <label className="form-label">Coins</label>
          <input name="amount" type="number" min="1" className="form-control mb-3" required />
          <label className="form-label">Reason <span className="text-danger">*</span></label>
          <input name="reason" className="form-control" required placeholder="e.g. 'paid cash at the shop'" />
          <div className="form-text">It goes to both the ledger and the audit log.</div>
        </Modal>
      )}
    </>
  );
}
