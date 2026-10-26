import { useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import { Badge, Card, ConfirmBox, Modal, Spinner, fmtNum, useToast } from '../ui/index.jsx';

// Colours a theme carries. The app reads `accent`; the rest are optional
// extras. An empty box saves as "not set".
const COLORS = [
  ['primary',    'Primary'],
  ['secondary',  'Secondary'],
  ['background', 'Background'],
  ['surface',    'Surface / cards'],
  ['text',       'Text'],
];

function ColorField({ name, label, value }) {
  const [v, setV] = useState(value || '');
  return (
    <div className="col-6">
      <label className="form-label small mb-1">{label}</label>
      <div className="input-group input-group-sm">
        <input type="color" className="form-control form-control-color" style={{ maxWidth: 44 }}
               value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'}
               onChange={(e) => setV(e.target.value)} />
        <input name={name} className="form-control" value={v} placeholder="not set"
               onChange={(e) => setV(e.target.value)} />
      </div>
    </div>
  );
}

function ThemeForm({ theme }) {
  const isNew = !theme;
  const t = theme || {};
  return (
    <div className="row g-2">
      <div className="col-6">
        <label className="form-label small mb-1">Key {isNew && <span className="text-danger">*</span>}</label>
        <input name="key" className="form-control" defaultValue={t.key || ''} required={isNew}
               disabled={!isNew} placeholder="ocean" />
        <div className="form-text">{isNew ? 'Letters, digits, - or _. Cannot be changed later.' : 'Fixed once created.'}</div>
      </div>
      <div className="col-6">
        <label className="form-label small mb-1">Name <span className="text-danger">*</span></label>
        <input name="name" className="form-control" defaultValue={t.name || ''} required />
      </div>
      <ColorField name="accent" label="Accent (shown in the picker)" value={t.accent} />
      {COLORS.map(([k, label]) => (
        <ColorField key={k} name={`c.${k}`} label={label} value={t.colors?.[k]} />
      ))}
      <div className="col-6">
        <label className="form-label small mb-1">Sort order</label>
        <input name="sortOrder" type="number" className="form-control" defaultValue={t.sortOrder ?? 0} />
        <div className="form-text">Premium themes unlock in this order, per the plan's theme limit.</div>
      </div>
      <div className="col-12">
        <div className="form-check">
          <input className="form-check-input" type="checkbox" name="isPremium" id="th-prem"
                 defaultChecked={t.isPremium !== false} />
          <label className="form-check-label" htmlFor="th-prem">Premium — needs a plan</label>
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" name="isActive" id="th-act"
                 defaultChecked={t.isActive !== false} />
          <label className="form-check-label" htmlFor="th-act">Show in the app</label>
        </div>
      </div>
    </div>
  );
}

const readTheme = (v, isNew) => {
  const colors = {};
  for (const [k] of COLORS) colors[k] = (v[`c.${k}`] || '').trim() || null;
  return {
    ...(isNew ? { key: (v.key || '').trim() } : {}),
    name: v.name,
    accent: (v.accent || '').trim() || null,
    colors,
    sortOrder: Number(v.sortOrder) || 0,
    isPremium: v.isPremium === 'on',
    isActive: v.isActive === 'on',
  };
};

export default function Themes() {
  const { toast, showError } = useToast();
  const { data, loading, reload } = useApi(() => api.get('/themes'), []);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); toast(okMsg); setDialog(null); reload(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  if (loading) return <><h1 className="h4 mb-3">Themes</h1><Spinner /></>;
  const themes = data?.data?.themes || [];

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0">Themes</h1>
        <button className="btn btn-sm btn-primary ms-auto" onClick={() => setDialog({ kind: 'new' })}>
          <i className="bi bi-plus-lg" /> New theme
        </button>
      </div>
      <div className="alert alert-info py-2 small">
        Free themes are open to everyone. How many <strong>premium</strong> themes a user gets is the
        plan's <em>Themes</em> limit (Plans page) — they unlock in sort order.
      </div>

      {themes.length ? (
        <div className="row g-3">
          {themes.map((t) => (
            <div className="col-md-6 col-xl-4" key={t._id}>
              <div className={`card shadow-sm h-100 ${t.isActive ? '' : 'opacity-75'}`}>
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="rounded-circle border d-inline-block"
                            style={{ width: 28, height: 28, background: t.accent || t.colors?.primary || '#eee' }} />
                      <div>
                        <h6 className="mb-0">{t.name}</h6>
                        <code className="small text-secondary">{t.key}</code>
                      </div>
                    </div>
                    <div className="text-end">
                      {t.isPremium ? <Badge kind="warning">premium</Badge> : <Badge kind="light">free</Badge>}
                      {!t.isActive && <Badge>hidden</Badge>}
                    </div>
                  </div>
                  <div className="d-flex gap-1 mb-2">
                    {COLORS.map(([k, label]) => t.colors?.[k] && (
                      <span key={k} title={`${label} ${t.colors[k]}`} className="rounded border"
                            style={{ width: 22, height: 22, background: t.colors[k] }} />
                    ))}
                  </div>
                  <div className="small text-secondary">
                    sort {t.sortOrder} · {fmtNum(t.users)} user{t.users === 1 ? '' : 's'} using it
                  </div>
                </div>
                <div className="card-footer bg-white border-top-0 d-flex gap-2">
                  <button className="btn btn-sm btn-outline-primary flex-grow-1"
                          onClick={() => setDialog({ kind: 'edit', theme: t })}>Edit</button>
                  <button className="btn btn-sm btn-outline-danger"
                          onClick={() => setDialog({ kind: 'del', theme: t })}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card><div className="text-center text-secondary py-5">No themes yet — start with "New theme".</div></Card>
      )}

      {dialog?.kind === 'new' && (
        <Modal title="New theme" confirmText="Create" busy={busy} size="modal-lg"
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(() => api.post('/themes', readTheme(v, true)), 'Theme created')}>
          <ThemeForm />
        </Modal>
      )}
      {dialog?.kind === 'edit' && (
        <Modal title={`Edit ${dialog.theme.name}`} confirmText="Save" busy={busy} size="modal-lg"
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(() => api.put(`/themes/${dialog.theme._id}`, readTheme(v, false)), 'Theme updated')}>
          <ThemeForm theme={dialog.theme} />
        </Modal>
      )}
      {dialog?.kind === 'del' && (
        <ConfirmBox
          title="Delete theme"
          message={<><strong>{dialog.theme.name}</strong> is removed. If users have picked it, the
            server refuses — switch it off ("Show in the app") instead.</>}
          confirmText="Delete" busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => act(() => api.del(`/themes/${dialog.theme._id}`), 'Theme deleted')}
        />
      )}
    </>
  );
}
