import { useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../useApi.js';
import {
  Badge, Card, ConfirmBox, Modal, Spinner, Table, fmtDate, useToast,
} from '../ui/index.jsx';

const ROLE_HELP = {
  superadmin: 'Everything — settings, money, admin accounts.',
  admin:      'Everything, except admin accounts and editing settings.',
  moderator:  'Blocks users and acts on reports. Cannot touch money.',
  support:    'Read access, and can grant a plan or coins (manual mode).',
  viewer:     'Read-only — changes nothing, and never reads private chats.',
};

function PermPicker({ all, chosen, name, label, help }) {
  return (
    <>
      <label className="form-label mt-3">{label}</label>
      <div className="form-text mb-2">{help}</div>
      <div className="border rounded p-2" style={{ maxHeight: 180, overflow: 'auto' }}>
        {all.map((p) => (
          <div className="form-check" key={p}>
            <input className="form-check-input" type="checkbox" name={name} value={p}
                   id={`${name}_${p.replace(/\W/g, '_')}`} defaultChecked={chosen.includes(p)} />
            <label className="form-check-label small" htmlFor={`${name}_${p.replace(/\W/g, '_')}`}>
              <code>{p}</code>
            </label>
          </div>
        ))}
      </div>
    </>
  );
}

// FormData collapses many checkboxes sharing a name into one value, so the
// permissions are read straight from the form's DOM
const readPerms = (form, name) =>
  [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);

export default function Admins() {
  const { me } = useAuth();
  const { toast, showError } = useToast();
  const { data, loading, reload } = useApi(
    async () => {
      const [admins, roles] = await Promise.all([api.get('/auth/admins'), api.get('/auth/roles')]);
      return { admins: admins.data.admins, roles: roles.data.roles, permissions: roles.data.permissions };
    },
    []
  );
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <><h1 className="h4 mb-3">Admin users</h1><Spinner /></>;

  const roles = Object.keys(data?.roles || {});
  const allPerms = data?.permissions || [];

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); toast(okMsg); setDialog(null); reload(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0">Admin users</h1>
        <button className="btn btn-sm btn-primary ms-auto" onClick={() => setDialog({ kind: 'new' })}>
          <i className="bi bi-plus-lg" /> New admin
        </button>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <Card>
            <Table columns={[
              { title: 'Admin', render: (a) => (
                <>
                  <div className="fw-semibold">
                    {a.name}
                    {String(a._id) === String(me?._id) && <Badge kind="info">you</Badge>}
                  </div>
                  <div className="small text-secondary">{a.email}</div>
                </>
              ) },
              { title: 'Role', render: (a) => (
                <>
                  <Badge kind={a.role === 'superadmin' ? 'danger' : 'dark'}>{a.role}</Badge>
                  {a.extraPermissions?.length > 0 && (
                    <div className="small text-success">+{a.extraPermissions.length} extra</div>
                  )}
                  {a.deniedPermissions?.length > 0 && (
                    <div className="small text-danger">−{a.deniedPermissions.length} denied</div>
                  )}
                </>
              ) },
              { title: 'Status', render: (a) => a.isActive
                ? <Badge kind="success">active</Badge>
                : <Badge>disabled</Badge> },
              { title: 'Last login', render: (a) => (
                <span className="small text-secondary">{fmtDate(a.lastLoginAt)}</span>
              ) },
              { title: 'Created', render: (a) => (
                <span className="small text-secondary">{fmtDate(a.createdAt)}</span>
              ) },
              { title: '', className: 'text-end', render: (a) => (
                <div className="btn-group btn-group-sm">
                  <button className="btn btn-outline-secondary"
                          onClick={() => setDialog({ kind: 'edit', a })}>Edit</button>
                  {String(a._id) !== String(me?._id) && (
                    <button className={`btn btn-outline-${a.isActive ? 'danger' : 'success'}`}
                            onClick={() => setDialog({ kind: 'toggle', a })}>
                      {a.isActive ? 'Disable' : 'Enable'}
                    </button>
                  )}
                </div>
              ) },
            ]} rows={data?.admins || []} empty="No admins" />
          </Card>
        </div>

        <div className="col-lg-4">
          <Card title="Roles">
            <div className="p-3">
              {roles.map((role) => (
                <div className="mb-3" key={role}>
                  <div className="fw-semibold">
                    {role}{' '}
                    <span className="badge bg-light text-dark">
                      {(data.roles[role] || []).length} perms
                    </span>
                  </div>
                  <div className="small text-secondary">{ROLE_HELP[role] || ''}</div>
                  <details className="small mt-1">
                    <summary className="text-primary" style={{ cursor: 'pointer' }}>permissions</summary>
                    <div className="mt-1">
                      {(data.roles[role] || []).map((p) => <code className="me-1" key={p}>{p}</code>)}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {dialog?.kind === 'new' && (
        <Modal title="New admin" confirmText="Create" busy={busy} size="modal-lg"
               onClose={() => setDialog(null)}
               onSubmit={(v, form) => act(
                 () => api.post('/auth/admins', {
                   name: v.name, email: v.email, password: v.password, role: v.role,
                   extraPermissions: readPerms(form, 'extraPermissions'),
                   deniedPermissions: readPerms(form, 'deniedPermissions'),
                 }),
                 'Admin created'
               )}>
          <label className="form-label">Name <span className="text-danger">*</span></label>
          <input name="name" className="form-control mb-3" required />
          <label className="form-label">Email <span className="text-danger">*</span></label>
          <input name="email" type="email" className="form-control mb-3" required />
          <label className="form-label">Password <span className="text-danger">*</span></label>
          <input name="password" type="password" className="form-control" required minLength={8} />
          <div className="form-text mb-3">
            At least 8 characters. Ask them to change it after their first sign-in.
          </div>
          <label className="form-label">Role</label>
          <select name="role" className="form-select" defaultValue="support">
            {roles.map((x) => <option key={x} value={x}>{x} — {ROLE_HELP[x] || ''}</option>)}
          </select>
          <PermPicker all={allPerms} chosen={[]} name="extraPermissions"
                      label="Extra permissions" help="Granted on top of the role." />
          <PermPicker all={allPerms} chosen={[]} name="deniedPermissions"
                      label="Denied permissions"
                      help="Withheld even if the role grants it — deny always wins." />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title={`Edit ${dialog.a.email}`} confirmText="Save" busy={busy} size="modal-lg"
               onClose={() => setDialog(null)}
               onSubmit={(v, form) => act(
                 () => api.put(`/auth/admins/${dialog.a._id}`, {
                   name: v.name, role: v.role,
                   ...(v.password ? { password: v.password } : {}),
                   extraPermissions: readPerms(form, 'extraPermissions'),
                   deniedPermissions: readPerms(form, 'deniedPermissions'),
                 }),
                 'Admin updated'
               )}>
          <label className="form-label">Name</label>
          <input name="name" className="form-control mb-3" defaultValue={dialog.a.name} />
          <label className="form-label">Role</label>
          <select name="role" className="form-select mb-3" defaultValue={dialog.a.role}>
            {roles.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <label className="form-label">New password (empty = unchanged)</label>
          <input name="password" type="password" className="form-control mb-3" minLength={8} />
          <PermPicker all={allPerms} chosen={dialog.a.extraPermissions || []}
                      name="extraPermissions" label="Extra permissions"
                      help="Granted on top of the role." />
          <PermPicker all={allPerms} chosen={dialog.a.deniedPermissions || []}
                      name="deniedPermissions" label="Denied permissions"
                      help="Withheld even if the role grants it." />
        </Modal>
      )}

      {dialog?.kind === 'toggle' && (
        <ConfirmBox
          title={dialog.a.isActive ? 'Disable admin' : 'Enable admin'}
          message={dialog.a.isActive
            ? <><strong>{dialog.a.email}</strong> will not be able to sign in.
                The account is not deleted — their name stays in the audit log.</>
            : <><strong>{dialog.a.email}</strong> will be able to sign in again.</>}
          confirmText={dialog.a.isActive ? 'Disable' : 'Enable'}
          danger={dialog.a.isActive} busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => act(
            () => api.put(`/auth/admins/${dialog.a._id}`, { isActive: !dialog.a.isActive }),
            dialog.a.isActive ? 'Admin disabled' : 'Admin enabled'
          )}
        />
      )}
    </>
  );
}
