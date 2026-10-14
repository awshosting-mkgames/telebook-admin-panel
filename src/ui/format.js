// ─── Small formatters — every page displays through these ───────────────────
//
//  React escapes for us, so the old `esc()` helper is no longer needed.

export const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const fmtDay = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtNum = (v) =>
  v === null || v === undefined || Number.isNaN(Number(v)) ? '0' : Number(v).toLocaleString('en-IN');

export const fmtMoney = (v, cur = 'INR') => {
  const n = Number(v) || 0;
  const symbol = cur === 'INR' ? '₹' : `${cur} `;
  return `${symbol}${n.toLocaleString('en-IN')}`;
};

export const fmtDuration = (sec) => {
  const s = Math.max(0, Number(sec) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** ISO date (yyyy-mm-dd) — for date inputs */
export const iso = (d) => new Date(d).toISOString().slice(0, 10);

/** The date this many days ago */
export const since = (days) => iso(Date.now() - days * 86400000);
