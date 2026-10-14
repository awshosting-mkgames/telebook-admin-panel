import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi, useQueryState } from '../useApi.js';
import {
  Badge, Card, Pager, Spinner, Stat, StatusBadge, Table,
  fmtDate, fmtMoney, fmtNum, useToast,
} from '../ui/index.jsx';

const MODE_HELP = {
  manual: `An admin grants the plan or coins. The money arrives outside the app
           (cash, UPI, a shop) — a record is still written so the revenue report
           stays complete.`,
  play: `Google Play Billing. Play's own screen opens inside the app, Play takes
         the money, and the backend verifies the purchase token.`,
  gateway: `A third-party gateway (Razorpay). The backend creates the order, the
            app opens checkout, and a signature plus webhook confirm it.`,
};

function ModeCard({ k, label, configured, effective, warnings, canConfig, onToggle }) {
  const warn = (warnings || []).filter((w) => w.toLowerCase().includes(k));
  const on = effective[k];
  return (
    <div className="col-md-4">
      <div className="card shadow-sm h-100">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="mb-0">{label}</h6>
            {on ? <Badge kind="success">live</Badge>
              : configured[k] ? <Badge kind="warning">on, but not working</Badge>
              : <Badge>off</Badge>}
          </div>
          <p className="small text-secondary">{MODE_HELP[k]}</p>
          {warn.length > 0 && (
            <div className="alert alert-warning py-2 small mb-2">
              {warn.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}
          {canConfig && (
            <div className="form-check form-switch">
              <input className="form-check-input" type="checkbox" role="switch" id={`mode-${k}`}
                     checked={!!configured[k]} onChange={(e) => onToggle(k, e.target.checked)} />
              <label className="form-check-label small" htmlFor={`mode-${k}`}>Chalu rakho</label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Payments() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const can = useCan();
  const { toast, showError } = useToast();

  const q = {
    mode: params.get('mode') || '',
    status: params.get('status') || '',
    purpose: params.get('purpose') || '',
    userId: params.get('userId') || '',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };

  const { data, loading, reload } = useApi(
    async () => {
      const [modes, payments] = await Promise.all([
        api.get('/payments/modes'),
        api.get('/payments', q),
      ]);
      return { m: modes.data, p: payments.data };
    },
    [q.mode, q.status, q.purpose, q.userId, q.page]
  );

  const saveModes = async (changes) => {
    try {
      const out = await api.put('/payments/modes', changes);
      toast(out.message || 'Modes updated');
      if ((out.data?.warnings || []).length) toast(out.data.warnings.join(' · '), 'warning');
    } catch (err) { showError(err); }
    finally { reload(); }
  };

  if (loading) return <><h1 className="h4 mb-3">Payments</h1><Spinner /></>;

  const m = data?.m;
  const p = data?.p;
  const rev = p?.revenueByMode || {};
  const total = Object.values(rev).reduce((a, r) => a + (r.amount || 0), 0);

  return (
    <>
      <h1 className="h4 mb-3">Payments</h1>

      <div className="row g-3 mb-1">
        <Stat label="Kul revenue" value={fmtMoney(total, m?.currency)} sub="successful payments only" />
        {Object.entries(rev).map(([k, r]) => (
          <Stat key={k} label={k} value={fmtMoney(r.amount, m?.currency)}
                sub={`${fmtNum(r.count)} payments`} />
        ))}
      </div>

      <h2 className="h6 text-secondary mt-4 mb-2">Payment modes</h2>
      <div className="row g-3 mb-2">
        {[['manual', 'Manual (admin)'], ['play', 'Google Play Billing'], ['gateway', 'Gateway (Razorpay)']]
          .map(([k, label]) => (
            <ModeCard key={k} k={k} label={label}
                      configured={m.configured} effective={m.effective} warnings={m.warnings}
                      canConfig={can('payments.config')}
                      onToggle={(key, val) => saveModes({ [key]: val })} />
          ))}
      </div>

      {can('payments.config') && (
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <div className="form-check form-switch mb-1">
              <input className="form-check-input" type="checkbox" role="switch" id="playStoreFlag"
                     checked={!!m.distributedOnPlayStore}
                     onChange={(e) => saveModes({ distributedOnPlayStore: e.target.checked })} />
              <label className="form-check-label" htmlFor="playStoreFlag">
                The app is distributed on the Play Store
              </label>
            </div>
            <div className="form-text">
              Play's policy: an app distributed through the Play Store must take
              payment for digital goods through Play Billing. With this on, the
              gateway checkout is hidden inside the app — the backend can still keep
              both (for a website or a direct APK).
            </div>
          </div>
        </div>
      )}

      <h2 className="h6 text-secondary mt-4 mb-2">Transactions</h2>
      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({
          mode: f.get('mode'), status: f.get('status'),
          purpose: f.get('purpose'), userId: f.get('userId'), page: 1,
        });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-2">
            <label className="form-label small mb-1">Mode</label>
            <select name="mode" className="form-select" defaultValue={q.mode} key={q.mode}>
              <option value="">any</option>
              {['manual', 'play', 'gateway'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">Status</label>
            <select name="status" className="form-select" defaultValue={q.status} key={q.status}>
              <option value="">any</option>
              {['pending', 'success', 'failed', 'refunded'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label small mb-1">For</label>
            <select name="purpose" className="form-select" defaultValue={q.purpose} key={q.purpose}>
              <option value="">any</option>
              <option value="plan">plan</option>
              <option value="coins">coins</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small mb-1">User ID</label>
            <input name="userId" className="form-control" defaultValue={q.userId} key={q.userId}
                   placeholder="empty = all" />
          </div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Apply</button></div>
        </div>
      </form>

      <Card>
        <Table columns={[
          { title: 'When', render: (t) => <span className="small text-secondary">{fmtDate(t.createdAt)}</span> },
          { title: 'User', render: (t) => t.user ? (
            <>
              <Link to={`/users?id=${t.user._id}`} className="text-decoration-none">
                {t.user.name || t.user.mobile}
              </Link>
              <div className="small text-secondary">{t.user.mobile}</div>
            </>
          ) : <span className="text-secondary">—</span> },
          { title: 'What', render: (t) => t.purpose === 'coins' ? (
            <><Badge kind="warning">coins</Badge> <span className="small">{fmtNum(t.coins)} coins</span></>
          ) : (
            <><Badge kind="primary">plan</Badge> <span className="small">{t.planCode || t.productId || ''}</span></>
          ) },
          { title: 'Mode', render: (t) => <Badge kind={t.mode === 'manual' ? 'secondary' : 'dark'}>{t.mode}</Badge> },
          { title: 'Amount', className: 'text-end', render: (t) => t.amount
            ? fmtMoney(t.amount, t.currency)
            : <span className="text-secondary small">outside the app</span> },
          { title: 'Status', render: (t) => (
            <>
              <StatusBadge status={t.status} />
              {t.failureReason && <div className="small text-danger">{t.failureReason}</div>}
            </>
          ) },
          { title: 'Reference', render: (t) => t.reference
            ? <code className="small text-break">{t.reference}</code>
            : t.createdByName ? <span className="small">{t.createdByName}</span>
            : <span className="text-secondary">—</span> },
          { title: 'Note', render: (t) => t.note
            ? <span className="small">{t.note}</span>
            : <span className="text-secondary">—</span> },
        ]} rows={p?.payments || []} empty="No payments found" />
        <Pager pagination={p?.pagination} onPage={(pg) => patch({ page: pg })} />
      </Card>
    </>
  );
}
