import { useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import {
  Badge, Card, ConfirmBox, Modal, Spinner, fmtDate, fmtNum, useToast,
} from '../ui/index.jsx';

// Sticker files go through the app's own presigned upload (/api/media), and
// only their storage KEY arrives here. That way the panel needs no second
// upload path — you paste the key the upload returned.
const KeyHelp = () => (
  <div className="form-text">
    Storage key — returned by uploading through <code>/api/media/presign</code>
    (<code>purpose: "sticker"</code>). The panel does not upload, so the key is
    pasted in.
  </div>
);

function PackForm({ pack = {} }) {
  return (
    <>
      <label className="form-label">Name <span className="text-danger">*</span></label>
      <input name="name" className="form-control mb-3" required defaultValue={pack.name || ''} />

      <label className="form-label">Description</label>
      <textarea name="description" className="form-control mb-3" rows="2"
                defaultValue={pack.description || ''} />

      <label className="form-label">Cover key</label>
      <input name="coverKey" className="form-control" defaultValue={pack.coverKey || ''} />
      <KeyHelp />

      <label className="form-label mt-3">Sort order</label>
      <input name="sortOrder" type="number" className="form-control mb-3" defaultValue={pack.sortOrder ?? 0} />

      <div className="form-check">
        <input className="form-check-input" type="checkbox" name="isPremium" id="isPremium"
               defaultChecked={pack.isPremium !== false} />
        <label className="form-check-label" htmlFor="isPremium">
          Premium — subscribers only
        </label>
      </div>
      <div className="form-check">
        <input className="form-check-input" type="checkbox" name="isActive" id="isActive"
               defaultChecked={pack.isActive !== false} />
        <label className="form-check-label" htmlFor="isActive">Show in the app</label>
      </div>
    </>
  );
}

const readPack = (v) => ({
  name: v.name,
  description: v.description,
  coverKey: v.coverKey || null,
  sortOrder: Number(v.sortOrder) || 0,
  isPremium: v.isPremium === 'on',
  isActive: v.isActive === 'on',
});

export default function Stickers() {
  const { toast, showError } = useToast();
  const { data, loading, reload } = useApi(() => api.get('/stickers'), []);
  const [dialog, setDialog] = useState(null);   // {kind, pack}
  const [busy, setBusy] = useState(false);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); toast(okMsg); setDialog(null); reload(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  if (loading) return <><h1 className="h4 mb-3">Stickers</h1><Spinner /></>;
  const packs = data?.data?.packs || [];

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h1 className="h4 mb-0">Sticker packs</h1>
        <button className="btn btn-sm btn-primary ms-auto" onClick={() => setDialog({ kind: 'new' })}>
          <i className="bi bi-plus-lg" /> New pack
        </button>
      </div>

      {packs.length ? (
        <div className="row g-3">
          {packs.map((p) => (
            <div className="col-md-6 col-xl-4" key={p._id}>
              <div className={`card shadow-sm h-100 ${p.isActive ? '' : 'opacity-75'}`}>
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between mb-2">
                    <div>
                      <h6 className="mb-0">{p.name}</h6>
                      <div className="small text-secondary">{fmtNum(p.stickerCount)} stickers</div>
                    </div>
                    <div className="text-end">
                      {p.isPremium ? <Badge kind="warning">premium</Badge> : <Badge kind="light">free</Badge>}
                      {!p.isActive && <Badge>hidden</Badge>}
                    </div>
                  </div>
                  {p.description && <p className="small mb-2">{p.description}</p>}
                  {p.coverKey && (
                    <div className="small text-secondary text-break mb-2">
                      cover: <code>{p.coverKey}</code>
                    </div>
                  )}

                  {p.stickers?.length > 0 && (
                    <details className="mb-2">
                      <summary className="small text-primary" style={{ cursor: 'pointer' }}>
                        See stickers
                      </summary>
                      <div className="table-responsive mt-2">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr><th>#</th><th>Key</th><th className="text-center">Emoji</th>
                                <th className="text-end">Order</th></tr>
                          </thead>
                          <tbody>
                            {p.stickers.map((st, i) => (
                              <tr key={st.key || i}>
                                <td className="small">{i + 1}</td>
                                <td><code className="small text-break">{st.key}</code></td>
                                <td className="text-center">{st.emoji || ''}</td>
                                <td className="text-end">{st.order ?? i}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  )}

                  <div className="small text-secondary">
                    sort {p.sortOrder} · {p.createdByName ? `${p.createdByName} · ` : ''}{fmtDate(p.createdAt)}
                  </div>
                </div>
                <div className="card-footer bg-white border-top-0 d-flex gap-2">
                  <button className="btn btn-sm btn-outline-primary flex-grow-1"
                          onClick={() => setDialog({ kind: 'edit', pack: p })}>Edit</button>
                  <button className="btn btn-sm btn-outline-secondary" title="Add a sticker"
                          onClick={() => setDialog({ kind: 'add', pack: p })}>
                    <i className="bi bi-plus-lg" />
                  </button>
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
        <Card>
          <div className="text-center text-secondary py-5">
            No sticker packs yet — start with "New pack".
          </div>
        </Card>
      )}

      {dialog?.kind === 'new' && (
        <Modal title="New sticker pack" confirmText="Create" busy={busy}
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(() => api.post('/stickers', readPack(v)), 'Pack created')}>
          <PackForm />
        </Modal>
      )}

      {dialog?.kind === 'edit' && (
        <Modal title={`Edit ${dialog.pack.name}`} confirmText="Save" busy={busy}
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(
                 () => api.put(`/stickers/${dialog.pack._id}`, readPack(v)),
                 'Pack updated'
               )}>
          <PackForm pack={dialog.pack} />
        </Modal>
      )}

      {dialog?.kind === 'add' && (
        <Modal title="Add a sticker" confirmText="Add" busy={busy}
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(
                 () => api.put(`/stickers/${dialog.pack._id}`, {
                   addStickers: [{ key: v.key, emoji: v.emoji || '', order: Number(v.order) || 0 }],
                 }),
                 'Sticker added'
               )}>
          <label className="form-label">Storage key <span className="text-danger">*</span></label>
          <input name="key" className="form-control" required placeholder="stickers/…" />
          <KeyHelp />
          <label className="form-label mt-3">Emoji</label>
          <input name="emoji" className="form-control mb-3" placeholder="😄" />
          <label className="form-label">Order</label>
          <input name="order" type="number" className="form-control" defaultValue={0} />
        </Modal>
      )}

      {dialog?.kind === 'del' && (
        <ConfirmBox
          title="Delete pack"
          message={<><strong>{dialog.pack.name}</strong> is removed entirely. Messages that
            already used it are unaffected.</>}
          confirmText="Delete" busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => act(() => api.del(`/stickers/${dialog.pack._id}`), 'Pack deleted')}
        />
      )}
    </>
  );
}
