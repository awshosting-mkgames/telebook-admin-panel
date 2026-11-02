import { api } from '../api.js';
import { useApi } from '../useApi.js';
import { Badge, Card } from './index.jsx';

// Every switch that can limit what testers see, in one place (state, where it is set, env lock).
const SWITCHES = [
  ['features.plans',              'Plan system',               'Off = everything open, Plans screen hidden'],
  ['features.enforceLimits',      'Enforce plan limits',       'Blocks groups / broadcasts / members / favourites past the plan limit'],
  ['features.coins',              'Coins',                     'Off = calls free, wallet hidden'],
  ['features.boosts',             'Channel boosts',            'Needs Coins on'],
  ['features.autoReply',          'Auto reply',                'Premium feature toggle'],
  ['features.twoStepPin',         'Two-step PIN',              ''],
  ['features.readReceiptsToggle', 'Read-receipts toggle',      ''],
  ['features.deviceSessions',     'Device sessions (logout)',  'Linked devices logout really ends the session'],
  ['features.enforcePrivateChannels', 'Private channels enforced', ''],
  ['features.encryptMessages',    'Message encryption',        'Also needs MESSAGE_ENCRYPTION_KEY in .env'],
];

const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

export default function FeatureSwitches() {
  const { data, loading } = useApi(() => api.get('/settings'), []);
  if (loading || !data?.data) return null;
  const { settings, envLocked = [], envLockedBy = {}, runtime = {} } = data.data;
  const legacyExempt = settings.planRollout?.legacyClientsExempt !== false;

  const rows = SWITCHES.map(([key, label, hint]) => ({
    key, label, hint, on: get(settings, key) !== false && get(settings, key) !== undefined ? !!get(settings, key) : false,
    lock: envLocked.includes(key) ? envLockedBy[key] : null,
  }));

  return (
    <Card title="Feature switches (testing overview)">
      <table className="table table-sm align-middle mb-2">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td style={{ width: '34%' }}><div className="fw-semibold">{r.label}</div><code className="small text-secondary">{r.key}</code></td>
              <td style={{ width: 90 }}><Badge kind={r.on ? 'success' : 'secondary'}>{r.on ? 'ON' : 'OFF'}</Badge></td>
              <td className="small text-secondary">
                {r.hint}
                {r.lock && <div className="text-danger">Fixed in server .env ({r.lock}) — remove that line and restart to control it from here.</div>}
              </td>
            </tr>
          ))}
          <tr>
            <td><div className="fw-semibold">Old app builds exempt from plans</div><code className="small text-secondary">planRollout.legacyClientsExempt</code></td>
            <td><Badge kind={legacyExempt ? 'warning' : 'success'}>{legacyExempt ? 'YES' : 'NO'}</Badge></td>
            <td className="small text-secondary">YES = builds that don't send X-App-Build see no limits.</td>
          </tr>
          <tr>
            <td><div className="fw-semibold">Privacy enforcement</div><code className="small text-secondary">PRIVACY_ENFORCE (.env)</code></td>
            <td><Badge kind={runtime.privacyEnforce ? 'success' : 'secondary'}>{runtime.privacyEnforce ? 'ON' : 'OFF'}</Badge></td>
            <td className="small text-secondary">Last seen / photo / about / status settings are applied by the server. Default ON.</td>
          </tr>
          <tr>
            <td><div className="fw-semibold">Message encryption key</div><code className="small text-secondary">MESSAGE_ENCRYPTION_KEY (.env)</code></td>
            <td><Badge kind={runtime.messageEncryptionKey ? 'success' : 'warning'}>{runtime.messageEncryptionKey ? 'SET' : 'MISSING'}</Badge></td>
            <td className="small text-secondary">Without the key nothing is encrypted even if the switch is ON.</td>
          </tr>
          <tr>
            <td><div className="fw-semibold">Share-link domain</div><code className="small text-secondary">APP_BASE_URL (.env)</code></td>
            <td><Badge kind="info">{runtime.appBaseUrl || 'default'}</Badge></td>
            <td className="small text-secondary">Should be https://telebookservices.com</td>
          </tr>
        </tbody>
      </table>
      <div className="small text-secondary">Change switches in Settings → features (or the cards above for plans). The three money switches can be locked by .env.</div>
    </Card>
  );
}
