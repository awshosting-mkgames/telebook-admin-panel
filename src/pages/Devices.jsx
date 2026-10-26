import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import { Card, ConfirmBox, Pager, Spinner, Table, fmtDate, useToast } from '../ui/index.jsx';
import { useCan } from '../auth.jsx';

// Every signed-in device across all users. Signing one out here is the same
// action as on the user's page: its token stops working immediately.
export default function Devices() {
  const can = useCan();
  const { toast, showError } = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [revoke, setRevoke] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useApi(
    () => api.get('/devices', { q, page, limit: 25 }), [q, page]
  );

  const rows = data?.data?.devices || [];

  const doRevoke = async () => {
    setBusy(true);
    try {
      await api.del(`/users/${revoke.user._id}/devices/${encodeURIComponent(revoke.deviceId)}`);
      toast('Device signed out');
      setRevoke(null);
      reload();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h1 className="h4 mb-3">Active devices</h1>
      <Card>
        <form className="p-3 border-bottom d-flex gap-2"
              onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(e.target.q.value.trim()); }}>
          <input name="q" className="form-control form-control-sm" placeholder="Search by user name or mobile" defaultValue={q} />
          <button className="btn btn-sm btn-outline-secondary">Search</button>
        </form>
        {loading ? <Spinner /> : (
          <>
            <Table rows={rows} rowKey={(r) => `${r.user?._id}:${r.deviceId}`} empty="No active devices"
              columns={[
                { title: 'User', render: (r) => r.user ? (
                  <Link to={`/users?id=${r.user._id}`}>{r.user.name || r.user.mobile}</Link>
                ) : '—' },
                { title: 'Plan', render: (r) => r.user?.plan || '—' },
                { title: 'Device', render: (r) => (
                  <>{r.deviceName || r.deviceId}
                    <div className="small text-secondary">{r.deviceType} {r.osVersion || ''} · app {r.appVersion || '—'}</div></>
                ) },
                { title: 'Last active', render: (r) => fmtDate(r.lastActiveAt) },
                { title: 'IP', render: (r) => r.lastIp || '—' },
                { title: '', className: 'text-end', render: (r) => can('users.block') && r.user && (
                  <button className="btn btn-sm btn-outline-danger" onClick={() => setRevoke(r)}>Sign out</button>
                ) },
              ]} />
            <Pager pagination={data?.data?.pagination} onPage={setPage} />
          </>
        )}
      </Card>
      {revoke && (
        <ConfirmBox title="Sign out device"
          message={<>Sign <strong>{revoke.deviceName || revoke.deviceId}</strong> out of{' '}
            {revoke.user?.name || revoke.user?.mobile}'s account? Its token stops working immediately.</>}
          confirmText="Sign out" busy={busy}
          onCancel={() => setRevoke(null)} onConfirm={doRevoke} />
      )}
    </>
  );
}
