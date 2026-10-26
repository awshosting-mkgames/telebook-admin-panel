import { useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import { Badge, Card, ConfirmBox, Modal, Spinner, fmtNum, useToast } from '../ui/index.jsx';

// Emojis are typed or pasted as plain text — one per line, optionally followed
// by a label ("😀 smile"). Duplicates are dropped by the server.
const toText = (emojis) => (emojis || []).map((e) => (e.label ? `${e.char} ${e.label}` : e.char)).join('\n');
const fromText = (text) =>
  String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(' ');
    return i === -1 ? { char: l, label: '' } : { char: l.slice(0, i), label: l.slice(i + 1).trim() };
  });

function PackForm({ pack = {} }) {
  return (
    <>
      <label className="form-label">Name <span className="text-danger">*</span></label>
      <input name="name" className="form-control mb-3" required defaultValue={pack.name || ''} />

      <label className="form-label">Description</label>
      <textarea name="description" className="form-control mb-3" rows="2" defaultValue={pack.description || ''} />

      <div className="row g-2 mb-3">
        <div className="col-6">
          <label className="form-label">Cover emoji</label>
          <input name="icon" className="form-control" defaultValue={pack.icon || ''} placeholder="😄" />
        </div>
        <div className="col-6">
          <label className="form-label">Sort order</label>
          <input name="sortOrder" type="number" className="form-control" defaultValue={pack.sortOrder ?? 0} />
        </div>
      </div>

      <label className="form-label">Emojis</label>
      <textarea name="emojis" className="form-control mb-1" rows="6" defaultValue={toText(pack.emojis)}
                placeholder={'😀 smile\n😂 laugh\n🔥'} />
      <div className="form-text mb-3">One per line. A label after a space is optional.</div>

      <div className="form-check">
        <input className="form-check-input" type="checkbox" name="isPremium" id="em-prem"
               defaultChecked={pack.isPremium !== false} />
        <label className="form-check-label" htmlFor="em-prem">Premium — subscribers only</label>
      </div>
      <div className="form-check">
        <input className="form-check-input" type="checkbox" name="isActive" id="em-act"
               defaultChecked={pack.isActive !== false} />
        <label className="form-check-label" htmlFor="em-act">Show in the app</label>
      </div>
    </>
  );
}

const readPack = (v) => ({
  name: v.name,
  description: v.description,
  icon: (v.icon || '').trim() || null,
  sortOrder: Number(v.sortOrder) || 0,
  emojis: fromText(v.emojis),
  isPremium: v.isPremium === 'on',
  isActive: v.isActive === 'on',
});

export default function Emojis() {
  const { toast, showError } = useToast();
  const { data, loading, reload } = useApi(() => api.get('/emojis'), []);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); toast(okMsg); setDialog(null); reload(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  if (loading) return <><h1 className="h4 mb-3">Emoji packs</h1><Spinner /></>;
  const packs = data?.data?.packs || [];

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0">Emoji packs</h1>
        <button className="btn btn-sm btn-primary ms-auto" onClick={() => setDialog({ kind: 'new' })}>
          <i className="bi bi-plus-lg" /> New pack
        </button>
      </div>
      <div className="alert alert-info py-2 small">
        Free packs are open to everyone. How many <strong>premium</strong> packs a user gets is the
        plan's <em>Premium emoji packs</em> limit — they unlock in sort order.
      </div>

      {packs.length ? (
        <div className="row g-3">
          {packs.map((p) => (
            <div className="col-md-6 col-xl-4" key={p._id}>
              <div className={`card shadow-sm h-100 ${p.isActive ? '' : 'opacity-75'}`}>
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between mb-2">
                    <div>
                      <h6 className="mb-0">{p.icon} {p.name}</h6>
                      <div className="small text-secondary">{fmtNum(p.emojiCount)} emojis</div>
                    </div>
                    <div className="text-end">
                      {p.isPremium ? <Badge kind="warning">premium</Badge> : <Badge kind="light">free</Badge>}
                      {!p.isActive && <Badge>hidden</Badge>}
                    </div>
                  </div>
                  {p.description && <p className="small mb-2">{p.description}</p>}
                  <div className="fs-5 text-break" style={{ maxHeight: 72, overflow: 'hidden' }}>
                    {(p.emojis || []).slice(0, 24).map((e) => e.char).join(' ')}
                  </div>
                  <div className="small text-secondary mt-2">sort {p.sortOrder}</div>
                </div>
                <div className="card-footer bg-white border-top-0 d-flex gap-2">
                  <button className="btn btn-sm btn-outline-primary flex-grow-1"
                          onClick={() => setDialog({ kind: 'edit', pack: p })}>Edit</button>
                  <button className="btn btn-sm btn-outline-danger"
                          onClick={() => setDialog({ kind: 'del', pack: p })}>
                    <i className="bi bi-trash" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card><div className="text-center text-secondary py-5">No emoji packs yet — start with "New pack".</div></Card>
      )}

      {dialog?.kind === 'new' && (
        <Modal title="New emoji pack" confirmText="Create" busy={busy}
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(() => api.post('/emojis', readPack(v)), 'Pack created')}>
          <PackForm />
        </Modal>
      )}
      {dialog?.kind === 'edit' && (
        <Modal title={`Edit ${dialog.pack.name}`} confirmText="Save" busy={busy}
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(() => api.put(`/emojis/${dialog.pack._id}`, readPack(v)), 'Pack updated')}>
          <PackForm pack={dialog.pack} />
        </Modal>
      )}
      {dialog?.kind === 'del' && (
        <ConfirmBox
          title="Delete pack"
          message={<><strong>{dialog.pack.name}</strong> is removed entirely.</>}
          confirmText="Delete" busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => act(() => api.del(`/emojis/${dialog.pack._id}`), 'Pack deleted')}
        />
      )}
    </>
  );
}
