import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../useApi.js';
import {
  Badge, Card, ConfirmBox, Modal, Spinner, fmtDate, fmtNum, useToast,
} from '../ui/index.jsx';

// Sticker files are uploaded straight to storage with a short-lived link the
// backend hands out (POST /stickers/upload-url); only the storage KEY is saved
// on the pack. If storage is not configured the panel says so and the old
// "paste a key" box still works.

const ALLOWED = ['image/webp', 'image/png', 'image/jpeg', 'image/gif'];

// Preview links live ~10 min — cache them so re-rendering does not refetch
const previewCache = new Map();

/** Thumbnail of a stored sticker (needs a presigned GET — admins cannot use the user media route) */
function StickerImg({ k, size = 40 }) {
  const [url, setUrl] = useState(previewCache.get(k)?.url || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const hit = previewCache.get(k);
    if (hit && hit.at > Date.now() - 8 * 60000) { setUrl(hit.url); return undefined; }
    setFailed(false);
    api.get('/stickers/preview-url', { key: k })
      .then((res) => {
        previewCache.set(k, { url: res.data.url, at: Date.now() });
        if (live) setUrl(res.data.url);
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [k]);

  const box = { width: size, height: size };
  if (!k || failed || !url) {
    return (
      <div className="rounded bg-light d-flex align-items-center justify-content-center text-secondary"
           style={box} title={failed ? 'Preview not available' : ''}>
        <i className="bi bi-image" />
      </div>
    );
  }
  return <img src={url} alt="" className="rounded border" style={{ ...box, objectFit: 'contain' }}
              onError={() => setFailed(true)} />;
}

/** Key input + "Upload image" button. The input is named, so Modal's FormData picks it up. */
function KeyField({ name, defaultValue = '', required = false, placeholder }) {
  const { showError } = useToast();
  const [value, setValue] = useState(defaultValue);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef(null);

  const upload = async (file) => {
    if (!file) return;
    setNote('');
    if (!ALLOWED.includes(file.type)) {
      setNote('Only webp, png, jpeg or gif images can be uploaded.');
      return;
    }
    setUploading(true);
    try {
      const res = await api.post('/stickers/upload-url', {
        fileName: file.name, contentType: file.type, fileSize: file.size,
      });
      const { uploadUrl, key, headers } = res.data;
      const put = await fetch(uploadUrl, { method: 'PUT', headers, body: file });
      if (!put.ok) throw new Error(`Storage refused the upload (${put.status})`);
      setValue(key);
      previewCache.delete(key);
      setNote('Uploaded — the key is filled in below.');
    } catch (err) {
      if (err.status === 503 || err.code === 'STORAGE_UNAVAILABLE') {
        setNote('Upload is not available (file storage is not configured on the server). Paste a storage key instead.');
      } else if (err.status) {
        showError(err);
      } else {
        setNote(`Upload failed — ${err.message}. If this keeps happening, the storage bucket may not allow uploads from this site (CORS); paste a key instead.`);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <div className="input-group">
        <input name={name} className="form-control" value={value} required={required}
               placeholder={placeholder} onChange={(e) => setValue(e.target.value)} />
        <button type="button" className="btn btn-outline-secondary" disabled={uploading}
                onClick={() => fileRef.current?.click()}>
          {uploading
            ? <span className="spinner-border spinner-border-sm" />
            : <><i className="bi bi-upload" /> Upload</>}
        </button>
        <input ref={fileRef} type="file" accept={ALLOWED.join(',')} className="d-none"
               onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      {value && (
        <div className="mt-2 d-flex align-items-center gap-2">
          <StickerImg k={value} size={48} />
          <span className="small text-secondary text-break">{value}</span>
        </div>
      )}
      {note && <div className="form-text">{note}</div>}
      <div className="form-text">
        Upload an image (webp / png / jpeg / gif), or paste an existing storage key.
      </div>
    </>
  );
}

function PackForm({ pack = {} }) {
  return (
    <>
      <label className="form-label">Name <span className="text-danger">*</span></label>
      <input name="name" className="form-control mb-3" required defaultValue={pack.name || ''} />

      <label className="form-label">Description</label>
      <textarea name="description" className="form-control mb-3" rows="2"
                defaultValue={pack.description || ''} />

      <label className="form-label">Cover key</label>
      <KeyField name="coverKey" defaultValue={pack.coverKey || ''} />

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
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <StickerImg k={p.coverKey} size={48} />
                      <span className="small text-secondary text-break">cover: <code>{p.coverKey}</code></span>
                    </div>
                  )}

                  {p.stickers?.length > 0 && (
                    <details className="mb-2">
                      <summary className="small text-primary" style={{ cursor: 'pointer' }}>
                        See stickers
                      </summary>
                      <div className="table-responsive mt-2">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr><th>#</th><th></th><th>Key</th><th className="text-center">Emoji</th>
                                <th className="text-end">Order</th><th></th></tr>
                          </thead>
                          <tbody>
                            {p.stickers.map((st, i) => (
                              <tr key={st.key || i}>
                                <td className="small">{i + 1}</td>
                                <td><StickerImg k={st.key} /></td>
                                <td><code className="small text-break">{st.key}</code></td>
                                <td className="text-center">{st.emoji || ''}</td>
                                <td className="text-end">{st.order ?? i}</td>
                                <td className="text-end text-nowrap">
                                  <button className="btn btn-sm btn-outline-secondary me-1" title="Replace the image"
                                          onClick={() => setDialog({ kind: 'replace', pack: p, sticker: st })}>
                                    <i className="bi bi-arrow-repeat" />
                                  </button>
                                  <button className="btn btn-sm btn-outline-danger" title="Delete this sticker"
                                          onClick={() => setDialog({ kind: 'rmsticker', pack: p, sticker: st })}>
                                    <i className="bi bi-trash" />
                                  </button>
                                </td>
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
          <KeyField name="key" required placeholder="sticker/…" />
          <label className="form-label mt-3">Emoji</label>
          <input name="emoji" className="form-control mb-3" placeholder="😄" />
          <label className="form-label">Order</label>
          <input name="order" type="number" className="form-control" defaultValue={0} />
        </Modal>
      )}

      {dialog?.kind === 'replace' && (
        <Modal title="Replace sticker image" confirmText="Replace" busy={busy}
               onClose={() => setDialog(null)}
               onSubmit={(v) => act(
                 () => api.put(`/stickers/${dialog.pack._id}`, {
                   removeKeys: [dialog.sticker.key],
                   addStickers: [{
                     key: v.key, emoji: dialog.sticker.emoji || '',
                     order: dialog.sticker.order ?? 0,
                   }],
                 }),
                 'Sticker replaced'
               )}>
          <div className="mb-3 d-flex align-items-center gap-2">
            <StickerImg k={dialog.sticker.key} size={48} />
            <span className="small text-secondary text-break">Current: {dialog.sticker.key}</span>
          </div>
          <label className="form-label">New image <span className="text-danger">*</span></label>
          <KeyField name="key" required />
          <div className="form-text">Emoji and order are kept.</div>
        </Modal>
      )}

      {dialog?.kind === 'rmsticker' && (
        <ConfirmBox
          title="Delete sticker"
          message={<>Remove this sticker from <strong>{dialog.pack.name}</strong>? Messages that
            already used it are unaffected.</>}
          confirmText="Delete" busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => act(
            () => api.put(`/stickers/${dialog.pack._id}`, { removeKeys: [dialog.sticker.key] }),
            'Sticker deleted'
          )}
        />
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
