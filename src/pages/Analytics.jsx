import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useQueryState } from '../useApi.js';
import {
  BarChart, Badge, Card, Pager, Spinner, Stat, Table,
  fmtDate, fmtMoney, fmtNum, iso, since,
} from '../ui/index.jsx';

const TABS = {
  revenue:     'Money',
  plans:       'Plans',
  subscribers: 'Users on a plan',
  users:       'Users',
  coins:       'Coins',
  engagement:  'In the app',
};

const PRESETS = [
  { days: 7,   label: '7 din' },
  { days: 30,  label: '30 din' },
  { days: 90,  label: '90 din' },
  { days: 365, label: '1 saal' },
];

const DATED = ['revenue', 'users', 'coins', 'engagement'];

function DateBar({ tab, params, patch }) {
  const from = params.get('from') || since(Number(params.get('days')) || 30);
  const to = params.get('to') || iso(Date.now());
  const groupBy = params.get('groupBy') || 'day';

  return (
    <form className="card shadow-sm mb-3" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      patch({ from: f.get('from'), to: f.get('to'), groupBy: f.get('groupBy'), days: '' });
    }}>
      <div className="card-body row g-2 align-items-end">
        <div className="col-auto">
          <label className="form-label small mb-1">From</label>
          <input name="from" type="date" className="form-control" defaultValue={from} key={`f${from}`} />
        </div>
        <div className="col-auto">
          <label className="form-label small mb-1">To</label>
          <input name="to" type="date" className="form-control" defaultValue={to} key={`t${to}`} />
        </div>
        <div className="col-auto">
          <label className="form-label small mb-1">Group by</label>
          <select name="groupBy" className="form-select" defaultValue={groupBy} key={`g${groupBy}`}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <div className="col-auto"><button className="btn btn-primary">Show</button></div>
        <div className="col-auto ms-auto">
          <div className="btn-group btn-group-sm">
            {PRESETS.map((p) => (
              <Link key={p.days} className="btn btn-outline-secondary"
                    to={`/analytics?tab=${tab}&days=${p.days}&groupBy=${p.days > 120 ? 'month' : p.days > 45 ? 'week' : 'day'}`}>
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}

const dateQuery = (params) => ({
  from: params.get('from') || since(Number(params.get('days')) || 30),
  to: params.get('to') || iso(Date.now()),
  groupBy: params.get('groupBy') || 'day',
});

// ── Paisa ───────────────────────────────────────────────────────────────────
function Revenue({ params }) {
  const q = dateQuery(params);
  const { data, loading } = useApi(() => api.get('/analytics/revenue', q),
    [q.from, q.to, q.groupBy]);
  if (loading) return <Spinner />;
  const d = data?.data;
  if (!d) return null;

  return (
    <>
      <div className="row g-3 mb-1">
        <Stat label="Kul aaya" value={fmtMoney(d.totals.gross)} sub={`${fmtNum(d.totals.payments)} payments`} />
        <Stat label="Refunded" value={fmtMoney(d.totals.refunds)} sub="refunds" />
        <Stat label="Net" value={fmtMoney(d.totals.net)} sub="gross − refunds" />
        <Stat label="Average payment" value={fmtMoney(d.totals.averagePayment)}
              sub={`${fmtNum(d.totals.payingUsers)} logon ne diya`} />
      </div>

      <Card title="Revenue">
        <BarChart points={d.series.map((s) => ({ label: s.bucket, value: s.amount }))}
                  color="#198754" money />
      </Card>

      <div className="row g-3">
        <div className="col-lg-4">
          <Card title="By product">
            <Table columns={[
              { title: 'What', render: ([k]) => <Badge kind={k === 'plan' ? 'primary' : 'warning'}>{k}</Badge> },
              { title: 'Count', className: 'text-end', render: ([, v]) => fmtNum(v.count) },
              { title: 'Amount', className: 'text-end', render: ([, v]) => fmtMoney(v.amount) },
            ]} rows={Object.entries(d.byPurpose)} rowKey={([k]) => k} empty="nothing" />
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="By route">
            <Table columns={[
              { title: 'Mode', render: ([k]) => <Badge kind={k === 'manual' ? 'secondary' : 'dark'}>{k}</Badge> },
              { title: 'Count', className: 'text-end', render: ([, v]) => fmtNum(v.count) },
              { title: 'Amount', className: 'text-end', render: ([, v]) => fmtMoney(v.amount) },
            ]} rows={Object.entries(d.byMode)} rowKey={([k]) => k} empty="nothing" />
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="By plan">
            <Table columns={[
              { title: 'Plan', render: (p) => p.planCode },
              { title: 'Count', className: 'text-end', render: (p) => fmtNum(p.count) },
              { title: 'Amount', className: 'text-end', render: (p) => fmtMoney(p.amount) },
            ]} rows={d.byPlan} rowKey={(p) => p.planCode} empty="no plans sold" />
          </Card>
        </div>
      </div>

      <div className="alert alert-secondary small mt-3">
        This is money recorded as a <strong>successful</strong> payment. Gateway
        fees, tax and the store's cut are not deducted — so read it as
        <strong> income</strong>, not profit. For a manual plan the amount is the
        plan's price, even though the money arrived outside the app.
      </div>
    </>
  );
}

// ── Plans ───────────────────────────────────────────────────────────────────
function PlansTab() {
  const { data, loading } = useApi(() => api.get('/analytics/plans'), []);
  if (loading) return <Spinner />;
  const d = data?.data;
  if (!d) return null;

  return (
    <>
      <div className="row g-3 mb-1">
        <Stat label="Kul users" value={fmtNum(d.totals.users)} />
        <Stat label="On a plan" value={fmtNum(d.totals.subscribed)}
              sub={`${d.totals.conversionPercent}% of users are paying`} />
        <Stat label="Free users" value={fmtNum(d.totals.free)} />
        <Stat label="Expiring in 7 days" value={fmtNum(d.totals.expiringIn7Days)}
              sub="worth reminding them" />
      </div>
      <div className="row g-3 mb-1">
        <Stat label="Naye plan (30 din)" value={fmtNum(d.totals.newLast30Days)} />
        <Stat label="Khatam hue (30 din)" value={fmtNum(d.totals.expiredLast30Days)} />
      </div>

      <Card title="By plan">
        <Table columns={[
          { title: 'Plan', render: (p) => (
            <>
              <strong>{p.name}</strong>
              <div className="small text-secondary">
                <code>{p.code}</code> · {fmtMoney(p.price)} / {p.durationDays}d
                {!p.isActive && <Badge>hidden in app</Badge>}
              </div>
            </>
          ) },
          { title: 'Active now', className: 'text-end',
            render: (p) => <span className="fs-5 fw-semibold">{fmtNum(p.activeUsers)}</span> },
          { title: 'Active value', className: 'text-end', render: (p) => fmtMoney(p.activeValue) },
          { title: 'Earned so far', className: 'text-end', render: (p) => (
            <>
              {fmtMoney(p.lifetimeRevenue)}
              <div className="small text-secondary">{fmtNum(p.lifetimePayments)} payments</div>
            </>
          ) },
          { title: '', className: 'text-end', render: (p) => (
            <Link to={`/analytics?tab=subscribers&planCode=${p.code}`}
                  className="btn btn-sm btn-outline-secondary">See users</Link>
          ) },
        ]} rows={d.plans} rowKey={(p) => p.code} empty="No plans" />
      </Card>

      <Card title="How the plan was bought">
        <Table columns={[
          { title: 'How', render: ([k]) => <Badge kind={k === 'manual' ? 'secondary' : 'primary'}>{k}</Badge> },
          { title: 'Users', className: 'text-end', render: ([, v]) => fmtNum(v) },
        ]} rows={Object.entries(d.bySource)} rowKey={([k]) => k} empty="nothing" />
      </Card>
    </>
  );
}

// ── Users on a plan ─────────────────────────────────────────────────────────
function Subscribers({ params, patch }) {
  const q = {
    planCode: params.get('planCode') || '',
    expiringInDays: params.get('expiring') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page')) || 1,
    limit: 25,
  };
  const { data, loading } = useApi(() => api.get('/analytics/subscribers', q),
    [q.planCode, q.expiringInDays, q.sort, q.page]);

  return (
    <>
      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({ planCode: f.get('planCode'), expiring: f.get('expiring'), sort: f.get('sort'), page: 1 });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small mb-1">Plan code</label>
            <input name="planCode" className="form-control" defaultValue={q.planCode}
                   key={q.planCode} placeholder="all" />
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Expiring within (days)</label>
            <input name="expiring" type="number" min="1" className="form-control"
                   defaultValue={q.expiringInDays} key={q.expiringInDays} placeholder="all" />
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Order</label>
            <select name="sort" className="form-select" defaultValue={q.sort} key={q.sort}>
              <option value="newest">Newest first</option>
              <option value="expiry">Expiring soonest</option>
              <option value="value">Highest value first</option>
            </select>
          </div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Show</button></div>
        </div>
      </form>

      {loading ? <Spinner /> : (
        <Card title={`${fmtNum(data?.data?.pagination?.total)} users on a plan`}>
          <Table columns={[
            { title: 'User', render: (s) => s.user ? (
              <>
                <Link to={`/users?id=${s.user._id}`} className="text-decoration-none fw-semibold">
                  {s.user.name || '—'}
                </Link>
                <div className="small text-secondary">
                  {s.user.mobile}{s.user.isBlocked && <Badge kind="danger">blocked</Badge>}
                </div>
              </>
            ) : <span className="text-secondary">(deleted user)</span> },
            { title: 'Plan', render: (s) => (
              <>
                {s.planName}
                <div className="small text-secondary">{fmtMoney(s.price)} · {s.source}</div>
              </>
            ) },
            { title: 'Ends', render: (s) => (
              <>
                {fmtDate(s.endAt)}
                <div className={`small ${s.daysLeft <= 7 ? 'text-danger fw-semibold' : 'text-secondary'}`}>
                  {s.daysLeft} din bache
                </div>
              </>
            ) },
            { title: 'Paid so far', className: 'text-end', render: (s) => (
              <>
                <strong>{fmtMoney(s.lifetimeSpend)}</strong>
                <div className="small text-secondary">{fmtNum(s.lifetimePayments)} payments</div>
              </>
            ) },
            { title: 'Last seen', render: (s) => (
              <span className="small text-secondary">{s.user ? fmtDate(s.user.lastSeen) : '—'}</span>
            ) },
          ]} rows={data?.data?.subscribers || []}
             rowKey={(s) => s.user?._id || Math.random()}
             empty="Nobody found" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ page: p })} />
        </Card>
      )}
    </>
  );
}

// ── Users ───────────────────────────────────────────────────────────────────
function UsersTab({ params }) {
  const q = dateQuery(params);
  const { data, loading } = useApi(() => api.get('/analytics/users', q), [q.from, q.to, q.groupBy]);
  if (loading) return <Spinner />;
  const d = data?.data;
  if (!d) return null;

  return (
    <>
      <div className="row g-3 mb-1">
        <Stat label="Kul users" value={fmtNum(d.totals.users)} />
        <Stat label="On a plan" value={fmtNum(d.totals.withPlan)} />
        <Stat label="Aaj active" value={fmtNum(d.totals.activeToday)}
              sub={`${fmtNum(d.totals.activeThisWeek)} is hafte`} />
        <Stat label="Blocked / deleted"
              value={`${fmtNum(d.totals.blocked)} / ${fmtNum(d.totals.deleted)}`} />
      </div>
      <Card title="Naye users">
        <BarChart points={d.signups.map((s) => ({ label: s.bucket, value: s.count }))} />
      </Card>
      <div className="text-secondary small">
        "Active" means: the app was open in that period (from lastSeen).
      </div>
    </>
  );
}

// ── Coins ───────────────────────────────────────────────────────────────────
function CoinsTab({ params }) {
  const q = dateQuery(params);
  const { data, loading } = useApi(() => api.get('/analytics/coins', { from: q.from, to: q.to }),
    [q.from, q.to]);
  if (loading) return <Spinner />;
  const d = data?.data;
  if (!d) return null;

  return (
    <>
      <div className="row g-3 mb-1">
        <Stat label="Diye gaye" value={fmtNum(d.credited.total)} sub="bought + bonus + refunds" />
        <Stat label="Kharch hue" value={fmtNum(d.debited.total)} sub="calls + boosts" />
        <Stat label="Held by users" value={fmtNum(d.outstanding.coins)}
              sub={`${fmtNum(d.outstanding.wallets)} wallets`} />
        <Stat label="On boosts" value={fmtNum(d.boosts.coins)} sub={`${fmtNum(d.boosts.count)} boosts`} />
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <Card title="Where coins came from">
            <Table columns={[
              { title: 'Reason', render: ([k]) => k },
              { title: 'Coins', className: 'text-end', render: ([, v]) => fmtNum(v) },
            ]} rows={Object.entries(d.credited.byReason)} rowKey={([k]) => k} empty="nothing" />
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Coins kahan gaye">
            <Table columns={[
              { title: 'On what', render: ([k]) => k },
              { title: 'Coins', className: 'text-end', render: ([, v]) => fmtNum(v) },
            ]} rows={Object.entries(d.debited.byReason)} rowKey={([k]) => k} empty="nothing" />
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Calls">
            <Table columns={[
              { title: 'Tarah', render: (c) => <Badge kind={c.type === 'video' ? 'primary' : 'secondary'}>{c.type}</Badge> },
              { title: 'Calls', className: 'text-end', render: (c) => fmtNum(c.calls) },
              { title: 'Minute', className: 'text-end', render: (c) => fmtNum(Math.round(c.seconds / 60)) },
              { title: 'Coins', className: 'text-end', render: (c) => fmtNum(c.coins) },
            ]} rows={d.calls} rowKey={(c) => c.type} empty="no calls" />
          </Card>
        </div>
      </div>

      <div className="alert alert-secondary small mt-3">
        Coins "held by users" are a <strong>liability</strong> — the money is in and
        the service is still owed. That is why it is kept apart from income.
      </div>
    </>
  );
}

// ── Engagement ──────────────────────────────────────────────────────────────
function Engagement({ params }) {
  const q = dateQuery(params);
  const { data, loading } = useApi(() => api.get('/analytics/engagement', q),
    [q.from, q.to, q.groupBy]);
  if (loading) return <Spinner />;
  const d = data?.data;
  if (!d) return null;

  const totalCalls = d.calls.reduce((a, c) => a + c.count, 0);
  const answered = d.calls.reduce((a, c) => a + c.answered, 0);
  const seconds = d.calls.reduce((a, c) => a + c.seconds, 0);
  const msgs = d.messages.reduce((a, m) => a + m.count, 0);

  return (
    <>
      <div className="row g-3 mb-1">
        <Stat label="Messages" value={fmtNum(msgs)} />
        <Stat label="Calls" value={fmtNum(totalCalls)} sub={`${fmtNum(answered)} uthayi gayi`} />
        <Stat label="Talk time" value={`${fmtNum(Math.round(seconds / 60))} min`} />
        <Stat label="Answer rate"
              value={totalCalls ? `${Math.round((answered / totalCalls) * 100)}%` : '—'} />
      </div>
      <Card title="Messages">
        <BarChart points={d.messages.map((m) => ({ label: m.bucket, value: m.count }))} />
      </Card>
      <Card title="Calls">
        <BarChart points={d.calls.map((c) => ({ label: c.bucket, value: c.count }))} color="#6f42c1" />
      </Card>
      <Card title="Message types">
        <Table columns={[
          { title: 'Tarah', render: ([k]) => <Badge kind="dark">{k}</Badge> },
          { title: 'Count', className: 'text-end', render: ([, v]) => fmtNum(v) },
        ]} rows={Object.entries(d.messageTypes).sort((a, b) => b[1] - a[1])}
           rowKey={([k]) => k} empty="nothing" />
      </Card>
    </>
  );
}

export default function Analytics() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);
  const tab = TABS[params.get('tab')] ? params.get('tab') : 'revenue';

  return (
    <>
      <h1 className="h4 mb-3">Analytics</h1>
      <ul className="nav nav-tabs mb-3">
        {Object.entries(TABS).map(([k, label]) => (
          <li className="nav-item" key={k}>
            <Link className={`nav-link ${tab === k ? 'active' : ''}`} to={`/analytics?tab=${k}`}>
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {DATED.includes(tab) && <DateBar tab={tab} params={params} patch={patch} />}

      {tab === 'revenue'     && <Revenue params={params} />}
      {tab === 'plans'       && <PlansTab />}
      {tab === 'subscribers' && <Subscribers params={params} patch={patch} />}
      {tab === 'users'       && <UsersTab params={params} />}
      {tab === 'coins'       && <CoinsTab params={params} />}
      {tab === 'engagement'  && <Engagement params={params} />}
    </>
  );
}
