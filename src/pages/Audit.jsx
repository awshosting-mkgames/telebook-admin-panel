import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi, useQueryState } from '../useApi.js';
import { Badge, Card, Pager, Spinner, Table, fmtDate, fmtNum } from '../ui/index.jsx';

// The actions the backend writes — for the filter
const ACTIONS = [
  'admin.login', 'admin.create', 'admin.update', 'admin.password_change',
  'user.block', 'user.message_limit', 'user.device_revoke',
  'report.act',
  'plan.update', 'subscription.grant', 'subscription.extend', 'subscription.cancel',
  'coins.credit', 'coins.debit', 'coins.packs', 'coins.rates',
  'payments.modes',
  'channel.remove_posts', 'boost.cancel',
  'stickers.create', 'stickers.update', 'stickers.delete',
  'settings.update', 'settings.reset',
  'messages.view', 'messages.search', 'messages.export',
  'announcement.create', 'announcement.update', 'announcement.delete', 'announcement.push',
];

const kindOf = (action) => {
  if (action.startsWith('messages')) return 'info';
  if (action.startsWith('coins') || action.startsWith('payments') || action.startsWith('subscription')) return 'warning';
  if (action.includes('block') || action.includes('delete') || action.includes('remove') || action.includes('cancel')) return 'danger';
  if (action.startsWith('settings') || action.startsWith('admin')) return 'dark';
  return 'secondary';
};

// Make before/after readable by a person — raw JSON only when there is no
// better way
function Diff({ before, after }) {
  if (before == null && after == null) return null;
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];

  if (!keys.length) {
    return <span className="small">{JSON.stringify(after ?? before)}</span>;
  }

  return (
    <div className="small">
      {keys.map((k) => {
        const f = typeof b[k] === 'object' ? JSON.stringify(b[k]) : String(b[k] ?? '—');
        const t = typeof a[k] === 'object' ? JSON.stringify(a[k]) : String(a[k] ?? '—');
        if (f === t) return null;
        return (
          <div key={k}>
            <code>{k}</code>{' '}
            <span className="text-secondary">{f.slice(0, 40)}</span>
            <i className="bi bi-arrow-right mx-1" />
            <strong>{t.slice(0, 40)}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function Audit() {
  const [params, setParams] = useSearchParams();
  const { patch } = useQueryState(params, setParams);

  const q = {
    action: params.get('action') || '',
    targetType: params.get('targetType') || '',
    adminId: params.get('adminId') || '',
    page: Number(params.get('page')) || 1,
    limit: 50,
  };
  const { data, loading } = useApi(() => api.get('/audit', q),
    [q.action, q.targetType, q.adminId, q.page]);

  return (
    <>
      <h1 className="h4 mb-3">Audit log</h1>
      <p className="text-secondary small">
        Everything an admin did — money, accounts, settings, and reading or
        exporting someone's chat. This list is read-only; no entry can be
        deleted from the panel.
      </p>

      <form className="card shadow-sm mb-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        patch({ action: f.get('action'), targetType: f.get('targetType'),
                adminId: f.get('adminId'), page: 1 });
      }}>
        <div className="card-body row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label small mb-1">Action</label>
            <select name="action" className="form-select" defaultValue={q.action} key={q.action}>
              <option value="">any</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">On what</label>
            <select name="targetType" className="form-select" defaultValue={q.targetType} key={q.targetType}>
              <option value="">any</option>
              {['User', 'Chat', 'Message', 'Report', 'Plan', 'AppSetting', 'AdminUser',
                'Channel', 'ChannelBoost', 'StickerPack', 'Announcement']
                .map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small mb-1">Admin ID</label>
            <input name="adminId" className="form-control" defaultValue={q.adminId} key={q.adminId}
                   placeholder="empty = all" />
          </div>
          <div className="col-md-2"><button className="btn btn-primary w-100">Apply</button></div>
        </div>
      </form>

      {loading ? <Spinner /> : (
        <Card title={`${fmtNum(data?.data?.pagination?.total)} entries`}>
          <Table columns={[
            { title: 'When', render: (a) => <span className="small text-secondary">{fmtDate(a.createdAt)}</span> },
            { title: 'By', render: (a) => a.admin
              ? <span className="small">{a.admin}</span>
              : <span className="text-secondary small">system</span> },
            { title: 'What', render: (a) => <Badge kind={kindOf(a.action)}>{a.action}</Badge> },
            { title: 'On what', render: (a) => (
              <>
                {a.targetLabel && <div>{a.targetLabel}</div>}
                {a.targetType && <span className="small text-secondary">{a.targetType}</span>}
                {a.targetType === 'User' && a.targetId && (
                  <> <Link to={`/users?id=${a.targetId}`} className="small">open</Link></>
                )}
              </>
            ) },
            { title: 'Change', render: (a) => <Diff before={a.before} after={a.after} /> },
            { title: 'Reason', render: (a) => a.reason
              ? <span className="small">{a.reason}</span>
              : <span className="text-secondary">—</span> },
            { title: 'IP', render: (a) => a.ip ? <code className="small">{a.ip}</code> : null },
          ]} rows={data?.data?.entries || []} empty="No entries" />
          <Pager pagination={data?.data?.pagination} onPage={(p) => patch({ page: p })} />
        </Card>
      )}
    </>
  );
}
