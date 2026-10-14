import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi } from '../useApi.js';
import { Badge, Modal, Spinner, fmtMoney, fmtNum, useToast } from '../ui/index.jsx';

// Limits: -1 means unlimited. An empty box shows as unlimited here, so nobody
// has to remember to type "-1".
const LIMITS = [
  ['devices',             'Devices'],
  ['pins',                'Pinned chats'],
  ['groups',              'Groups created'],
  ['broadcasts',          'Broadcast lists'],
  ['broadcastRecipients', 'Broadcast recipients'],
  ['themes',              'Themes'],
  ['stickerPacks',        'Premium sticker packs'],
  ['autoReply',           'Auto Reply (1 = on)'],
];

const limVal = (v) => (v === -1 || v === 'unlimited' ? '∞' : fmtNum(v));

function EditPlan({ plan, onClose, onSaved }) {
  const { toast, showError } = useToast();
  const [busy, setBusy] = useState(false);

  const submit = async (v) => {
    const limits = {};
    for (const [k] of LIMITS) {
      const raw = v[`lim.${k}`];
      limits[k] = raw === '' ? -1 : Number(raw);
    }
    setBusy(true);
    try {
      const out = await api.put(`/plans/${plan.code}`, {
        name: v.name,
        description: v.description,
        price: Number(v.price),
        durationDays: Number(v.durationDays),
        badgeLabel: v.badgeLabel,
        badgeColor: v.badgeColor,
        badgeEnabled: v.badgeEnabled === 'on',
        isActive: v.isActive === 'on',
        playProductId: v.playProductId || null,
        gatewayPlanId: v.gatewayPlanId || null,
        limits,
      });
      toast(out.message || 'Plan updated');
      onSaved();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={`Edit ${plan.name}`} onClose={onClose} onSubmit={submit} busy={busy} size="modal-lg">
      <div className="alert alert-info py-2 small">
        These changes apply to <strong>new</strong> subscriptions only. Anyone who
        bought today keeps the terms they bought — what was sold is what they get.
      </div>
      <div className="row g-2">
        <div className="col-12">
          <label className="form-label small mb-1">Name</label>
          <input name="name" className="form-control" defaultValue={plan.name} required />
        </div>
        <div className="col-12">
          <label className="form-label small mb-1">Description</label>
          <textarea name="description" className="form-control" rows="2"
                    defaultValue={plan.description || ''} />
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">Price</label>
          <input name="price" type="number" className="form-control" defaultValue={plan.price} />
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">Duration (days)</label>
          <input name="durationDays" type="number" className="form-control" defaultValue={plan.durationDays} />
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">Badge label</label>
          <input name="badgeLabel" className="form-control" defaultValue={plan.badgeLabel || ''} />
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">Badge colour</label>
          <input name="badgeColor" type="color" className="form-control form-control-color w-100"
                 defaultValue={plan.badgeColor || '#6c757d'} />
        </div>
        <div className="col-12">
          <div className="form-check">
            <input className="form-check-input" type="checkbox" name="badgeEnabled" id="badgeEnabled"
                   defaultChecked={plan.badgeEnabled} />
            <label className="form-check-label small" htmlFor="badgeEnabled">Show the badge in chat</label>
          </div>
          <div className="form-check">
            <input className="form-check-input" type="checkbox" name="isActive" id="isActive"
                   defaultChecked={plan.isActive} />
            <label className="form-check-label small" htmlFor="isActive">Show it in the app for purchase</label>
          </div>
        </div>

        <div className="col-12">
          <hr className="my-2" /><strong className="small">Limits</strong>
          <div className="form-text">Empty = unlimited (saved as -1).</div>
        </div>
        {LIMITS.map(([k, label]) => (
          <div className="col-6" key={k}>
            <label className="form-label small mb-1">{label}</label>
            <input name={`lim.${k}`} type="number" className="form-control"
                   defaultValue={plan.limits?.[k] === -1 ? '' : (plan.limits?.[k] ?? '')}
                   placeholder="unlimited" />
          </div>
        ))}

        <div className="col-12"><hr className="my-2" /><strong className="small">Store product IDs</strong></div>
        <div className="col-6">
          <label className="form-label small mb-1">Play product ID</label>
          <input name="playProductId" className="form-control" defaultValue={plan.playProductId || ''} />
        </div>
        <div className="col-6">
          <label className="form-label small mb-1">Gateway plan ID</label>
          <input name="gatewayPlanId" className="form-control" defaultValue={plan.gatewayPlanId || ''} />
        </div>
      </div>
    </Modal>
  );
}

export default function Plans() {
  const can = useCan();
  const { data, loading, reload } = useApi(() => api.get('/plans'), []);
  const [editing, setEditing] = useState(null);

  if (loading) return <><h1 className="h4 mb-3">Plans</h1><Spinner /></>;

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0">Plans</h1>
        <Link to="/subscriptions" className="btn btn-sm btn-outline-secondary ms-auto">
          See subscriptions
        </Link>
      </div>

      <div className="row g-3">
        {(data?.data?.plans || []).map((p) => (
          <div className="col-md-6 col-xl-4" key={p.code}>
            <div className={`card shadow-sm h-100 ${p.isActive ? '' : 'opacity-75'}`}>
              <div className="card-body">
                <div className="d-flex align-items-start justify-content-between">
                  <div>
                    <h5 className="mb-0">{p.name}</h5>
                    <code className="small text-secondary">{p.code}</code>
                  </div>
                  <div className="text-end">
                    {p.badgeEnabled && p.badgeLabel && (
                      <span className="badge" style={{ background: p.badgeColor || '#6c757d' }}>
                        {p.badgeLabel}
                      </span>
                    )}
                    {!p.isActive && <Badge>hidden in app</Badge>}
                  </div>
                </div>

                <div className="my-3">
                  <span className="fs-4 fw-semibold">{fmtMoney(p.price, p.currency)}</span>
                  <span className="text-secondary"> / {fmtNum(p.durationDays)} days</span>
                </div>

                <div className="small text-secondary mb-2">
                  {fmtNum(p.activeSubscribers)} active subscriber{p.activeSubscribers === 1 ? '' : 's'}
                </div>

                {p.description && <p className="small mb-2">{p.description}</p>}

                <table className="table table-sm mb-0">
                  <tbody>
                    {LIMITS.map(([k, label]) => (
                      <tr key={k}>
                        <td className="text-secondary small border-0 ps-0">{label}</td>
                        <td className="text-end border-0 pe-0">{limVal(p.limits?.[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {can('plans.edit') && (
                <div className="card-footer bg-white border-top-0">
                  <button className="btn btn-sm btn-outline-primary w-100"
                          onClick={() => setEditing(p)}>Edit</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-secondary small mt-3">
        Creating a plan is deliberately not possible here — a plan code is tied to
        the app and to store product IDs, so new plans come from the seed script
        (<code>src/config/seedPlans.js</code>). Price, limits and visibility are
        edited here.
      </div>

      {editing && (
        <EditPlan plan={editing} onClose={() => setEditing(null)}
                  onSaved={() => { setEditing(null); reload(); }} />
      )}
    </>
  );
}
