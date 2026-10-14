import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useCan } from '../auth.jsx';
import { useApi } from '../useApi.js';
import { Badge, Card, ConfirmBox, Spinner, fmtNum, useToast } from '../ui/index.jsx';

// ─────────────────────────────────────────────────────────────────────────────
//  Settings
//
//  This page builds ITSELF from the defaults tree — no key is hard-coded
//  here. Add a tunable to the backend's defaults.js and it shows up, without
//  touching the panel.
//
//  Three things are made obvious:
//   • a value changed from its default ("changed" badge + a reset button)
//   • a value pinned by .env (read-only — changing it answers 409 ENV_LOCKED)
//   • a list or object value (as JSON, because it has its own page)
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS = {
  features:  { title: 'Feature switches', icon: 'toggles',
               help: 'The whole system on or off. Three monetisation switches may be pinned by .env.' },
  calls:     { title: 'Calling', icon: 'telephone',
               help: 'Call pricing is also on the Coins page — everything else is here.' },
  coins:     { title: 'Coins', icon: 'coin', help: 'Packs are edited on the Coins page.' },
  boosts:    { title: 'Boosts', icon: 'rocket', help: 'Options are edited on the Coins page.' },
  payments:  { title: 'Payments', icon: 'credit-card', help: 'Modes are also on the Payments page.' },
  limits:    { title: 'Free user limits', icon: 'bar-chart',
               help: 'What a user gets without a plan. A subscriber\'s limits live in the plan.' },
  media:     { title: 'Media', icon: 'image', help: 'Upload ceilings and how long URLs live.' },
  messaging: { title: 'Messaging', icon: 'chat-dots', help: '' },
  links:     { title: 'Deep links', icon: 'link-45deg', help: 'The invite link domain and paths.' },
};

// Keys with their own page — show them here, send people there to edit
const ELSEWHERE = {
  'coins.packs':    { page: '/coins?tab=packs', label: 'Coins → Coin packs' },
  'boosts.options': { page: '/coins?tab=rates', label: 'Coins → Rates' },
};

// Plain words for the big switches
const SWITCH_HELP = {
  'features.coins':  'OFF: calling is free, coins are never charged, the wallet is hidden.',
  'features.plans':  'OFF: every feature opens to everyone and the plans screen is hidden.',
  'features.boosts': 'OFF: boosts disappear entirely — "Sponsored" shows nowhere.',
  'features.enforceLimits': 'ON makes plan limits actually block (staged rollout).',
  'features.deviceSessions': 'ON: one account on one device (the plan\'s device limit applies).',
  'features.encryptMessages': 'ON: messages are encrypted in the database. The key must be in .env.',
};

const flat = (obj, prefix = '') => {
  const out = [];
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flat(v, key));
    else out.push([key, v]);
  }
  return out;
};

const pick = (obj, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Field({ k, value, def, envKey, canEdit, onChange, onReset }) {
  const changed = !same(value, def);
  const label = k.split('.').slice(1).join('.');
  const where = ELSEWHERE[k];
  const help = SWITCH_HELP[k];

  const meta = (
    <>
      {changed && !envKey && <Badge kind="warning">changed</Badge>}
      {envKey && <Badge kind="dark">.env: {envKey}</Badge>}
    </>
  );

  // ── Pinned by .env ──
  if (envKey) {
    return (
      <div className="row align-items-center py-2 border-bottom">
        <div className="col-md-5">
          <label className="form-label mb-0">{label}</label> {meta}
          {help && <div className="form-text">{help}</div>}
          <div className="form-text text-danger">
            This value comes from <code>.env</code> and cannot be changed here.
            Edit the server's <code>.env</code> and restart.
          </div>
        </div>
        <div className="col-md-7">
          <input className="form-control" value={String(value)} disabled readOnly />
        </div>
      </div>
    );
  }

  // ── Has its own page ──
  if (where) {
    return (
      <div className="row align-items-center py-2 border-bottom">
        <div className="col-md-5">
          <label className="form-label mb-0">{label}</label> {meta}
          <div className="form-text">
            {Array.isArray(value) ? `${fmtNum(value.length)} item(s) — ` : ''}
            edited under <Link to={where.page}>{where.label}</Link>.
          </div>
        </div>
        <div className="col-md-7">
          <pre className="bg-light rounded p-2 mb-0 small" style={{ maxHeight: 140, overflow: 'auto' }}>
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  const resetBtn = changed && canEdit && (
    <button type="button" className="btn btn-sm btn-link text-secondary p-0 ms-2"
            onClick={() => onReset(k)} title="Back to default">
      default ({String(def)})
    </button>
  );

  // ── Boolean ──
  if (typeof def === 'boolean') {
    return (
      <div className="row align-items-center py-2 border-bottom">
        <div className="col-md-5">
          <label className="form-label mb-0">{label}</label> {meta} {resetBtn}
          {help && <div className="form-text">{help}</div>}
        </div>
        <div className="col-md-7">
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" role="switch"
                   checked={!!value} disabled={!canEdit}
                   onChange={(e) => onChange(k, e.target.checked)} />
          </div>
        </div>
      </div>
    );
  }

  // ── Number / string ──
  const isNum = typeof def === 'number';
  return (
    <div className="row align-items-center py-2 border-bottom">
      <div className="col-md-5">
        <label className="form-label mb-0">{label}</label> {meta} {resetBtn}
        {help && <div className="form-text">{help}</div>}
      </div>
      <div className="col-md-7">
        <input className="form-control" type={isNum ? 'number' : 'text'}
               value={value ?? ''} disabled={!canEdit}
               onChange={(e) => onChange(k, isNum ? Number(e.target.value) : e.target.value)} />
      </div>
    </div>
  );
}

export default function Settings() {
  const [params] = useSearchParams();
  const can = useCan();
  const { toast, showError } = useToast();
  const { data, loading, reload } = useApi(() => api.get('/settings'), []);
  const [dirty, setDirty] = useState({});
  const [confirming, setConfirming] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <><h1 className="h4 mb-3">Settings</h1><Spinner /></>;

  const d = data?.data;
  if (!d) return null;

  // envLocked is the list of keys, envLockedBy maps each to its env variable
  const locked = { ...(d.envLockedBy || {}) };
  for (const k of d.envLocked || []) if (!locked[k]) locked[k] = 'set in .env';

  const open = GROUPS[params.get('group')] ? params.get('group') : 'features';
  const g = GROUPS[open];
  const rows = flat(d.settings[open] || {}, open);
  const lockedCount = Object.keys(locked).length;
  const canEdit = can('settings.edit');

  const current = (k) => (k in dirty ? dirty[k] : pick(d.settings, k));

  const change = (k, v) => {
    setDirty((old) => {
      const next = { ...old };
      if (same(v, pick(d.settings, k))) delete next[k];
      else next[k] = v;
      return next;
    });
  };

  const save = async () => {
    const keys = Object.keys(dirty);
    if (!keys.length) return toast('Nothing changed', 'info');

    // Switching monetisation off is a big call — confirm it
    const bigOnes = keys.filter((k) => SWITCH_HELP[k] && dirty[k] === false);
    if (bigOnes.length && !confirming) return setConfirming(bigOnes);

    setBusy(true);
    try {
      const out = await api.put('/settings', dirty);
      toast(out.message || 'Settings saved');
      setDirty({});
      setConfirming(null);
      reload();
    } catch (err) { showError(err); }     // a 409 ENV_LOCKED shows up clearly here
    finally { setBusy(false); }
  };

  const doReset = async () => {
    setBusy(true);
    try {
      const out = await api.del(`/settings/${encodeURIComponent(resetting)}`);
      toast(out.message || 'Reset to default');
      setResetting(null);
      setDirty({});
      reload();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const dirtyCount = Object.keys(dirty).length;

  return (
    <>
      <div className="d-flex align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h4 mb-0">Settings</h1>
        <span className="text-secondary small ms-2">
          changes reach every server within about 5 seconds
        </span>
      </div>

      {lockedCount > 0 && (
        <div className="alert alert-dark py-2">
          <i className="bi bi-lock-fill" />{' '}
          <strong>{fmtNum(lockedCount)} setting(s)</strong> are pinned by the server's
          <code>.env</code> and are read-only here. That is deliberate: changing these
          by accident from the panel would be expensive.
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-3">
          <div className="list-group shadow-sm">
            {Object.entries(GROUPS).map(([k, grp]) => (
              <Link key={k} to={`/settings?group=${k}`}
                    className={`list-group-item list-group-item-action ${open === k ? 'active' : ''}`}>
                <i className={`bi bi-${grp.icon} me-2`} />{grp.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="col-lg-9">
          <Card title={g.title}>
            <div className="p-3">
              {g.help && <p className="small text-secondary">{g.help}</p>}
              {rows.map(([key, value]) => (
                <Field key={key} k={key} value={current(key)} def={pick(d.defaults, key)}
                       envKey={locked[key]} canEdit={canEdit}
                       onChange={change} onReset={setResetting} />
              ))}
              {canEdit && (
                <div className="d-flex gap-2 mt-3">
                  <button className="btn btn-primary" onClick={save} disabled={busy}>
                    {busy && <span className="spinner-border spinner-border-sm me-2" />}
                    Save changes
                  </button>
                  <span className="text-secondary small align-self-center">
                    {dirtyCount ? `${dirtyCount} setting(s) changed` : ''}
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {confirming && (
        <ConfirmBox
          title="You are switching a feature off"
          message={
            <>
              <p>This will be switched off:</p>
              <ul className="mb-2">
                {confirming.map((k) => (
                  <li key={k}>
                    <code>{k}</code><br />
                    <span className="small text-secondary">{SWITCH_HELP[k]}</span>
                  </li>
                ))}
              </ul>
              <p className="mb-0">The app sees this within about 5 seconds.</p>
            </>
          }
          confirmText="Yes, switch it off" busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={save}
        />
      )}

      {resetting && (
        <ConfirmBox
          title="Back to default"
          message={<><code>{resetting}</code> will go back to its default value.</>}
          confirmText="Reset" danger={false} busy={busy}
          onCancel={() => setResetting(null)}
          onConfirm={doReset}
        />
      )}
    </>
  );
}
