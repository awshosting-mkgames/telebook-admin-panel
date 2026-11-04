import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi } from '../useApi.js';
import { Badge, Card, Spinner, useToast } from '../ui/index.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  System / Access settings
//
//  Privacy policy, terms, about, support contacts, app links and Razorpay keys
//  live in the database and are edited here. The server never sends a secret
//  back: a secret box starts empty, and is sent only if something is typed.
//  An empty box means "leave it unchanged"; "Remove" clears it explicitly.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  ['legal', 'Legal', 'file-earmark-text'],
  ['support', 'Support', 'headset'],
  ['payments', 'Payments', 'credit-card'],
  ['links', 'App links', 'link-45deg'],
];
const LEGAL = [
  ['privacyPolicy', 'Privacy policy'],
  ['termsAndConditions', 'Terms & conditions'],
  ['aboutUs', 'About us'],
];
const fmtDate = (d) => (d ? new Date(d).toLocaleString() : 'never edited');

export default function SystemSettings() {
  const can = useCan();
  const canEdit = can('settings.edit');
  const { toast, showError } = useToast();
  const { data, loading, reload } = useApi(() => api.get('/system-config'), []);
  const [tab, setTab] = useState('legal');
  const [form, setForm] = useState(null);
  const [secrets, setSecrets] = useState({ keySecret: '', webhookSecret: '' });
  const [clear, setClear] = useState({ keySecret: false, webhookSecret: false });
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState(null);

  const cfg = data?.data;

  // Server data -> editable copy (secrets never come back, so they stay empty)
  useEffect(() => {
    if (!cfg) return;
    setForm({
      privacyPolicy: { ...cfg.privacyPolicy },
      termsAndConditions: { ...cfg.termsAndConditions },
      aboutUs: { ...cfg.aboutUs },
      support: { ...cfg.support },
      appLinks: { ...cfg.appLinks },
      razorpay: { ...cfg.payments.razorpay },
    });
    setSecrets({ keySecret: '', webhookSecret: '' });
    setClear({ keySecret: false, webhookSecret: false });
  }, [cfg]);

  if (loading && !cfg) return <Spinner />;
  if (!cfg || !form) return null;

  const set = (section, key, val) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: val } }));

  const save = async () => {
    const rz = form.razorpay;
    const body = {
      privacyPolicy: pickLegal(form.privacyPolicy),
      termsAndConditions: pickLegal(form.termsAndConditions),
      aboutUs: pickLegal(form.aboutUs),
      support: form.support,
      appLinks: form.appLinks,
      payments: { razorpay: {
        keyId: rz.keyId, mode: rz.mode, enabled: !!rz.enabled,
        // Only typed secrets are sent; empty = unchanged
        ...(secrets.keySecret ? { keySecret: secrets.keySecret } : {}),
        ...(secrets.webhookSecret ? { webhookSecret: secrets.webhookSecret } : {}),
      } },
      clearSecrets: Object.keys(clear).filter((k) => clear[k]),
    };
    setBusy(true);
    try {
      const out = await api.put('/system-config', body);
      toast(out.changed?.length ? `Saved (${out.changed.length} field${out.changed.length > 1 ? 's' : ''})` : 'Nothing changed');
      (out.warnings || []).forEach((w) => toast(w));
      reload();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setTesting(true); setTestRes(null);
    try { setTestRes((await api.post('/system-config/razorpay/test', {})).data); }
    catch (err) { showError(err); }
    finally { setTesting(false); }
  };

  const eff = cfg.effective;
  const rz = form.razorpay;
  const dis = !canEdit;

  return (
    <>
      <div className="d-flex align-items-center mb-3">
        <h4 className="mb-0"><i className="bi bi-shield-check me-2" />System settings</h4>
        <span className="text-secondary small ms-3">
          Last saved {fmtDate(cfg.updatedAt === '1970-01-01T00:00:00.000Z' ? null : cfg.updatedAt)}{cfg.updatedBy ? ` by ${cfg.updatedBy}` : ''}
        </span>
        {canEdit && (
          <button className="btn btn-primary ms-auto" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>

      <ul className="nav nav-tabs mb-3">
        {TABS.map(([k, label, icon]) => (
          <li className="nav-item" key={k}>
            <button className={`nav-link ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
              <i className={`bi bi-${icon} me-1`} />{label}
            </button>
          </li>
        ))}
      </ul>

      {tab === 'legal' && LEGAL.map(([name, label]) => (
        <Card key={name} title={label}
              actions={<span className="small text-secondary">v{form[name].version} · {fmtDate(form[name].updatedAt)}</span>}>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Title</label>
                <input className="form-control" value={form[name].title} disabled={dis}
                       onChange={(e) => set(name, 'title', e.target.value)} />
              </div>
              <div className="col-md-6">
                <label className="form-label">External URL (optional)</label>
                <input className="form-control" placeholder="https://…" value={form[name].url} disabled={dis}
                       onChange={(e) => set(name, 'url', e.target.value)} />
              </div>
              <div className="col-12">
                <label className="form-label">Content (text / HTML)</label>
                <textarea className="form-control font-monospace" rows={10} maxLength={200000}
                          value={form[name].content} disabled={dis}
                          onChange={(e) => set(name, 'content', e.target.value)} />
                <div className="form-text">
                  If content is filled the app shows it; if empty it opens the URL. The version goes up automatically when title, content or URL changes.
                  {' '}{form[name].content.length.toLocaleString()} / 200,000 characters.
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}

      {tab === 'support' && (
        <Card title="Support contact">
          <div className="card-body row g-3">
            {[['email', 'Email'], ['phone', 'Phone'], ['whatsapp', 'WhatsApp']].map(([k, l]) => (
              <div className="col-md-4" key={k}>
                <label className="form-label">{l}</label>
                <input className="form-control" value={form.support[k]} disabled={dis}
                       onChange={(e) => set('support', k, e.target.value)} />
              </div>
            ))}
            <div className="col-12">
              <label className="form-label">Address</label>
              <textarea className="form-control" rows={2} value={form.support.address} disabled={dis}
                        onChange={(e) => set('support', 'address', e.target.value)} />
            </div>
          </div>
        </Card>
      )}

      {tab === 'links' && (
        <Card title="App links">
          <div className="card-body row g-3">
            <div className="col-md-6">
              <label className="form-label">Download URL</label>
              <input className="form-control" placeholder="https://…" value={form.appLinks.downloadUrl} disabled={dis}
                     onChange={(e) => set('appLinks', 'downloadUrl', e.target.value)} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Play Store URL</label>
              <input className="form-control" placeholder="https://play.google.com/…" value={form.appLinks.playStoreUrl} disabled={dis}
                     onChange={(e) => set('appLinks', 'playStoreUrl', e.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label">Share text</label>
              <textarea className="form-control" rows={3} value={form.appLinks.shareText} disabled={dis}
                        onChange={(e) => set('appLinks', 'shareText', e.target.value)} />
              <div className="form-text">Shown when a user shares / invites friends to the app.</div>
            </div>
            <div className="col-12"><hr className="my-1" />
              <div className="small text-secondary">
                Share-link bases (https). Every profile / channel / group link the server returns is built from these.
                Pre-filled with the current domain; clear a box to fall back to the server default.
              </div>
            </div>
            {[['profileLinkBase', 'Profile link base', 'https://telebookservices.com/u/'],
              ['channelLinkBase', 'Channel link base', 'https://telebookservices.com/c/'],
              ['groupInviteBase', 'Group invite base', 'https://telebookservices.com/g/']].map(([k, l, ph]) => (
              <div className="col-md-4" key={k}>
                <label className="form-label">{l}</label>
                <input className="form-control font-monospace" placeholder={ph} value={form.appLinks[k] || ''} disabled={dis}
                       onChange={(e) => set('appLinks', k, e.target.value.trim())} />
                {form.appLinks[k] && <div className="form-text">Example: {form.appLinks[k].replace(/\/?$/, '/')}abc123</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'payments' && (
        <Card title="Razorpay"
              actions={
                <>
                  <Badge kind={eff.razorpayKeySource === 'db' ? 'success' : eff.razorpayKeySource === 'env' ? 'info' : 'warning'}>
                    {eff.razorpayKeySource === 'db' ? 'Using DB credentials'
                      : eff.razorpayKeySource === 'env' ? 'Currently using .env credentials' : 'Not configured'}
                  </Badge>
                  {eff.effectiveKeyIdMasked && <span className="small text-secondary ms-2">{eff.effectiveKeyIdMasked}</span>}
                </>
              }>
          <div className="card-body row g-3">
            {!eff.encryptionAvailable && (
              <div className="col-12">
                <div className="alert alert-warning mb-0">
                  <code>MESSAGE_ENCRYPTION_KEY</code> is not set on the server, so secrets cannot be stored here.
                  The server keeps using the <code>RAZORPAY_*</code> values from <code>.env</code>.
                </div>
              </div>
            )}
            <div className="col-md-6">
              <label className="form-label">Key ID (public)</label>
              <input className="form-control font-monospace" placeholder="rzp_live_…" value={rz.keyId} disabled={dis}
                     onChange={(e) => set('razorpay', 'keyId', e.target.value.trim())} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Mode</label>
              <select className="form-select" value={rz.mode} disabled={dis}
                      onChange={(e) => set('razorpay', 'mode', e.target.value)}>
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="rz-en" checked={!!rz.enabled} disabled={dis}
                       onChange={(e) => set('razorpay', 'enabled', e.target.checked)} />
                <label className="form-check-label" htmlFor="rz-en">Enabled for app</label>
              </div>
            </div>

            {[['keySecret', 'Key secret', rz.hasKeySecret], ['webhookSecret', 'Webhook secret', rz.hasWebhookSecret]].map(([k, l, has]) => (
              <div className="col-md-6" key={k}>
                <label className="form-label">
                  {l} {has ? <Badge kind="success">set</Badge> : <Badge>not set</Badge>}
                </label>
                <div className="input-group">
                  <input type="password" autoComplete="new-password" className="form-control"
                         placeholder={has ? '•••• set (type to replace)' : '•••• not set'}
                         value={secrets[k]} disabled={dis || clear[k]}
                         onChange={(e) => setSecrets((s) => ({ ...s, [k]: e.target.value }))} />
                  {has && canEdit && (
                    <div className="input-group-text">
                      <input className="form-check-input mt-0 me-2" type="checkbox" id={`clr-${k}`} checked={clear[k]}
                             onChange={(e) => setClear((c) => ({ ...c, [k]: e.target.checked }))} />
                      <label htmlFor={`clr-${k}`} className="small mb-0">Remove</label>
                    </div>
                  )}
                </div>
                <div className="form-text">Stored encrypted. Left empty = unchanged. Never shown again after saving.</div>
              </div>
            ))}

            <div className="col-12">
              <label className="form-label">Webhook URL (paste in the Razorpay console)</label>
              <div className="input-group">
                <input className="form-control font-monospace" readOnly value={cfg.webhookUrl} />
                <button className="btn btn-outline-secondary" type="button"
                        onClick={() => navigator.clipboard?.writeText(cfg.webhookUrl).then(() => toast('Copied'))}>
                  <i className="bi bi-clipboard" />
                </button>
              </div>
              <div className="form-text">
                Events: payment.captured, payment.failed, order.paid, refund.processed. Webhook secret source:{' '}
                <b>{cfg.effective.webhookSecretSource === 'none' ? 'not set' : cfg.effective.webhookSecretSource === 'db' ? 'database' : '.env'}</b>.
              </div>
            </div>

            <div className="col-12 d-flex align-items-center gap-3">
              {canEdit && (
                <button className="btn btn-outline-primary" onClick={test} disabled={testing}>
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
              )}
              {testRes && (
                <span className={testRes.ok ? 'text-success' : 'text-danger'}>
                  <i className={`bi bi-${testRes.ok ? 'check-circle' : 'x-circle'} me-1`} />
                  {testRes.message} {testRes.source !== 'none' && <span className="text-secondary">({testRes.source === 'db' ? 'DB' : '.env'} credentials)</span>}
                </span>
              )}
              <span className="small text-secondary ms-auto">Test uses the credentials that are currently saved — save first.</span>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

const pickLegal = ({ title, content, url }) => ({ title, content, url });
