import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi } from '../useApi.js';
import {
  BarChart, Badge, Card, Spinner, Stat, Table,
  fmtDate, fmtMoney, fmtNum, since,
} from '../ui/index.jsx';

const RANGES = [
  { days: 7,   label: '7 days' },
  { days: 30,  label: '30 days' },
  { days: 90,  label: '90 days' },
  { days: 365, label: '1 year' },
];

export default function Dashboard() {
  const [params] = useSearchParams();
  const can = useCan();
  const days = Number(params.get('days')) || 30;
  const groupBy = days > 120 ? 'month' : days > 45 ? 'week' : 'day';

  // All at once — one after another would take five seconds, because Mongo
  // is remote. Anything without permission is skipped, and one failure does
  // not hold up the rest of the page.
  const { data, loading } = useApi(async () => {
    const maybe = (ok, p) => (ok ? p.catch(() => null) : Promise.resolve(null));
    const [dash, revenue, plans, users, coins] = await Promise.all([
      api.get('/dashboard').catch(() => null),
      maybe(can('payments.view'), api.get('/analytics/revenue', { from: since(days), groupBy })),
      maybe(can('plans.view'),    api.get('/analytics/plans')),
      api.get('/analytics/users', { from: since(days), groupBy }).catch(() => null),
      maybe(can('coins.view'),    api.get('/analytics/coins', { from: since(days) })),
    ]);
    return {
      d: dash?.data, rv: revenue?.data, pl: plans?.data,
      ua: users?.data, cn: coins?.data,
    };
  }, [days, groupBy]);

  if (loading) return <><h1 className="h4 mb-3">Dashboard</h1><Spinner /></>;

  const { d, rv, pl, ua, cn } = data || {};

  // Things needing attention go first — that is why anyone opens the panel
  const attention = [];
  if (d?.attention?.reportsPending) {
    attention.push(
      <Link key="r" to="/reports?status=pending" className="alert-link">
        {fmtNum(d.attention.reportsPending)} reports pending
      </Link>
    );
  }
  if (d?.attention?.usersOverMessageLimit) {
    attention.push(
      <Link key="o" to="/users?overLimit=true" className="alert-link">
        {fmtNum(d.attention.usersOverMessageLimit)} users over their message limit
      </Link>
    );
  }
  if (pl?.totals?.expiringIn7Days) {
    attention.push(
      <Link key="e" to="/analytics?tab=subscribers&expiring=7" className="alert-link">
        {fmtNum(pl.totals.expiringIn7Days)} plans expiring in 7 days
      </Link>
    );
  }

  return (
    <>
      <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h4 mb-0">Dashboard</h1>
        <div className="btn-group btn-group-sm ms-auto">
          {RANGES.map((r) => (
            <Link key={r.days} to={`/?days=${r.days}`}
                  className={`btn btn-${days === r.days ? 'primary' : 'outline-secondary'}`}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {attention.length > 0 && (
        <div className="alert alert-warning d-flex align-items-start gap-2">
          <i className="bi bi-exclamation-triangle-fill mt-1" />
          <div>
            {attention.map((a, i) => (
              <span key={i}>{i > 0 && ' · '}{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Money ── */}
      {rv && (
        <>
          <h2 className="h6 text-secondary mb-2">Money — last {days} days</h2>
          <div className="row g-3 mb-1">
            <Stat label="Gross" value={fmtMoney(rv.totals.gross)}
                  sub={`${fmtNum(rv.totals.payments)} payments`} />
            <Stat label="Refunded" value={fmtMoney(rv.totals.refunds)} sub="paid back" />
            <Stat label="Net" value={fmtMoney(rv.totals.net)} sub="gross − refunds" />
            <Stat label="Paying users" value={fmtNum(rv.totals.payingUsers)}
                  sub={`avg ${fmtMoney(rv.totals.averagePayment)}`} />
          </div>

          <div className="row g-3">
            <div className="col-lg-8">
              <Card title={`Revenue by ${rv.groupBy}`}>
                <BarChart points={rv.series.map((s) => ({ label: s.bucket, value: s.amount }))}
                          color="#198754" money />
              </Card>
            </div>
            <div className="col-lg-4">
              <Card title="By product">
                <Table
                  columns={[
                    { title: 'What', render: ([k]) => <Badge kind={k === 'plan' ? 'primary' : 'warning'}>{k}</Badge> },
                    { title: 'Amount', className: 'text-end', render: ([, v]) => fmtMoney(v.amount) },
                  ]}
                  rows={Object.entries(rv.byPurpose)}
                  rowKey={([k]) => k}
                  empty="nothing yet"
                />
              </Card>
              <Card title="By payment route">
                <Table
                  columns={[
                    { title: 'Mode', render: ([k]) => <Badge kind={k === 'manual' ? 'secondary' : 'dark'}>{k}</Badge> },
                    { title: 'Amount', className: 'text-end', render: ([, v]) => fmtMoney(v.amount) },
                  ]}
                  rows={Object.entries(rv.byMode)}
                  rowKey={([k]) => k}
                  empty="nothing yet"
                />
              </Card>
            </div>
          </div>

          <div className="text-secondary small mb-4">
            This is money recorded as a successful payment. Gateway fees, tax and
            the store's cut are not deducted — so read it as <strong>income</strong>,
            not profit.
          </div>
        </>
      )}

      {/* ── Plans ── */}
      {pl && (
        <>
          <h2 className="h6 text-secondary mb-2">Plans</h2>
          <div className="row g-3 mb-1">
            <Stat label="Total users" value={fmtNum(pl.totals.users)} />
            <Stat label="On a plan" value={fmtNum(pl.totals.subscribed)}
                  sub={`${pl.totals.conversionPercent}% of users`} />
            <Stat label="Free users" value={fmtNum(pl.totals.free)} />
            <Stat label="Expiring in 7 days" value={fmtNum(pl.totals.expiringIn7Days)}
                  sub={`${fmtNum(pl.totals.expiredLast30Days)} expired in the last 30 days`} />
          </div>

          <div className="row g-3 mb-4">
            <div className="col-lg-8">
              <Card title="By plan">
                <Table
                  columns={[
                    { title: 'Plan', render: (p) => (
                      <>
                        <strong>{p.name}</strong>
                        <div className="small text-secondary">
                          {fmtMoney(p.price)} / {p.durationDays}d
                          {!p.isActive && <Badge>hidden</Badge>}
                        </div>
                      </>
                    ) },
                    { title: 'Active now', className: 'text-end',
                      render: (p) => <span className="fs-5 fw-semibold">{fmtNum(p.activeUsers)}</span> },
                    { title: 'Earned so far', className: 'text-end', render: (p) => (
                      <>
                        {fmtMoney(p.lifetimeRevenue)}
                        <div className="small text-secondary">{fmtNum(p.lifetimePayments)} payments</div>
                      </>
                    ) },
                    { title: '', className: 'text-end', render: (p) => (
                      <Link to={`/analytics?tab=subscribers&planCode=${p.code}`}
                            className="btn btn-sm btn-outline-secondary">Users</Link>
                    ) },
                  ]}
                  rows={pl.plans}
                  rowKey={(p) => p.code}
                  empty="No plans"
                />
              </Card>
            </div>
            <div className="col-lg-4">
              <Card title="How the plan was bought">
                <Table
                  columns={[
                    { title: 'Route', render: ([k]) => <Badge kind={k === 'manual' ? 'secondary' : 'primary'}>{k}</Badge> },
                    { title: 'Users', className: 'text-end', render: ([, v]) => fmtNum(v) },
                  ]}
                  rows={Object.entries(pl.bySource)}
                  rowKey={([k]) => k}
                  empty="nothing yet"
                />
              </Card>
            </div>
          </div>
        </>
      )}

      {/* ── Users ── */}
      <h2 className="h6 text-secondary mb-2">Users</h2>
      <div className="row g-3 mb-1">
        <Stat label="Total users" value={fmtNum(d?.users?.total)}
              sub={`${fmtNum(d?.users?.newToday)} today · ${fmtNum(d?.users?.newThisWeek)} this week`} />
        <Stat label="Active today" value={fmtNum(ua?.totals?.activeToday)}
              sub={`${fmtNum(ua?.totals?.activeThisWeek)} this week`} />
        <Stat label="Blocked" value={fmtNum(d?.users?.blocked)} />
        <Stat label="Deleted" value={fmtNum(ua?.totals?.deleted)} />
      </div>

      {ua && (
        <div className="row g-3 mb-4">
          <div className="col-12">
            <Card title="New users">
              <BarChart points={ua.signups.map((s) => ({ label: s.bucket, value: s.count }))} />
            </Card>
          </div>
        </div>
      )}

      {/* ── In the app ── */}
      <h2 className="h6 text-secondary mb-2">In the app</h2>
      <div className="row g-3 mb-1">
        <Stat label="Messages today" value={fmtNum(d?.messaging?.today)}
              sub={`${fmtNum(d?.messaging?.total)} total`} />
        <Stat label="Groups" value={fmtNum(d?.messaging?.groups)} />
        <Stat label="Channels" value={fmtNum(d?.messaging?.channels)} />
        <Stat label="Calls today" value={fmtNum(d?.calls?.today)} />
      </div>

      {/* ── Coins ── */}
      {cn && (
        <>
          <h2 className="h6 text-secondary mt-4 mb-2">Coins — last {days} days</h2>
          <div className="row g-3 mb-1">
            <Stat label="Credited" value={fmtNum(cn.credited.total)} sub="bought + bonus + refunds" />
            <Stat label="Spent" value={fmtNum(cn.debited.total)} sub="calls + boosts" />
            <Stat label="Held by users" value={fmtNum(cn.outstanding.coins)}
                  sub={`${fmtNum(cn.outstanding.wallets)} wallets`} />
            <Stat label="On boosts" value={fmtNum(cn.boosts.coins)}
                  sub={`${fmtNum(cn.boosts.count)} boosts`} />
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <Card title="Calls">
                <Table
                  columns={[
                    { title: 'Type', render: (c) => <Badge kind={c.type === 'video' ? 'primary' : 'secondary'}>{c.type}</Badge> },
                    { title: 'Calls',  className: 'text-end', render: (c) => fmtNum(c.calls) },
                    { title: 'Minutes', className: 'text-end', render: (c) => fmtNum(Math.round(c.seconds / 60)) },
                    { title: 'Coins',  className: 'text-end', render: (c) => fmtNum(c.coins) },
                    { title: 'Avg', className: 'text-end', render: (c) => `${fmtNum(c.averageSeconds)}s` },
                  ]}
                  rows={cn.calls}
                  rowKey={(c) => c.type}
                  empty="No calls in this period"
                />
              </Card>
            </div>
            <div className="col-lg-6">
              <Card title="Where coins went">
                <Table
                  columns={[
                    { title: 'On what', render: ([k]) => k },
                    { title: 'Coins', className: 'text-end', render: ([, v]) => fmtNum(v) },
                  ]}
                  rows={Object.entries(cn.debited.byReason)}
                  rowKey={([k]) => k}
                  empty="nothing spent"
                />
              </Card>
            </div>
          </div>

          <div className="text-secondary small mt-2">
            Coins "held by users" are a <strong>liability</strong> — the money is in,
            the service is still owed.
          </div>
        </>
      )}

      <div className="text-secondary small mt-3">Last refreshed: {fmtDate(new Date())}</div>
    </>
  );
}
