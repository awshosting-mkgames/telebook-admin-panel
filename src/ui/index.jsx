// ─── The panel's small building blocks ──────────────────────────────────────

export { default as Modal, ConfirmBox } from './Modal.jsx';
export { useToast } from './Toast.jsx';
export * from './format.js';

const BADGE_KIND = {
  active: 'success', success: 'success', posted: 'success', live: 'success',
  pending: 'warning', scheduled: 'info',
  failed: 'danger', blocked: 'danger', deleted: 'danger', critical: 'danger',
  expired: 'secondary', cancelled: 'secondary', dismissed: 'secondary',
  refunded: 'info', reviewed: 'info',
};

export function Badge({ children, kind = 'secondary' }) {
  return <span className={`badge text-bg-${kind} ms-1`}>{children}</span>;
}

/** A status colour from its name — the same meaning on every page */
export function StatusBadge({ status }) {
  return <Badge kind={BADGE_KIND[status] || 'secondary'}>{status || '—'}</Badge>;
}

export function Spinner({ text = 'Loading…' }) {
  return (
    <div className="text-center text-secondary py-5">
      <div className="spinner-border spinner-border-sm me-2" role="status" />
      {text}
    </div>
  );
}

export function Card({ title, children, actions }) {
  return (
    <div className="card shadow-sm mb-3">
      {(title || actions) && (
        <div className="card-header bg-white d-flex align-items-center">
          <span className="fw-semibold">{title}</span>
          {actions && <span className="ms-auto">{actions}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/** One big figure — the dashboard and analytics are built from these */
export function Stat({ label, value, sub, col = 'col-6 col-lg-3' }) {
  return (
    <div className={col}>
      <div className="card shadow-sm h-100">
        <div className="card-body">
          <div className="text-secondary text-uppercase small">{label}</div>
          <div className="fs-3 fw-semibold lh-1 my-1">{value}</div>
          {sub && <div className="text-secondary small">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/**
 * Table.
 *
 * columns: [{ title, render(row), className?, width? }]
 */
export function Table({ columns, rows, empty = 'Nothing found', rowKey }) {
  if (!rows || !rows.length) {
    return <div className="text-center text-secondary py-5">{empty}</div>;
  }
  return (
    <div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={c.className} style={c.width ? { width: c.width } : undefined}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={rowKey ? rowKey(r, ri) : (r._id || ri)}>
              {columns.map((c, ci) => (
                <td key={ci} className={c.className}>{c.render(r, ri)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Paging — `pagination` is the object the API returns */
export function Pager({ pagination, onPage }) {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total } = pagination;

  // Pages near the start and end — "…" in between
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 2) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }

  return (
    <div className="d-flex align-items-center flex-wrap gap-2 p-3 border-top">
      <span className="text-secondary small">
        Page {page} of {pages} · {Number(total).toLocaleString('en-IN')} total
      </span>
      <nav className="ms-auto">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => onPage(page - 1)}>&laquo;</button>
          </li>
          {nums.map((n, i) => (
            <li key={i} className={`page-item ${n === page ? 'active' : ''} ${n === '…' ? 'disabled' : ''}`}>
              <button className="page-link" onClick={() => n !== '…' && onPage(n)}>{n}</button>
            </li>
          ))}
          <li className={`page-item ${page >= pages ? 'disabled' : ''}`}>
            <button className="page-link" onClick={() => onPage(page + 1)}>&raquo;</button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/**
 * A small bar chart, with no library.
 *
 *  Pulling in a 300 KB charting library for four charts would make it the
 *  largest dependency here. Inline SVG does the job and keeps the page fast.
 */
export function BarChart({ points, height = 110, color = '#0d6efd', money = false }) {
  if (!points?.length) {
    return <div className="text-secondary text-center py-5">Nothing happened in this period</div>;
  }
  const max = Math.max(...points.map((p) => p.value), 1);
  const w = 100 / points.length;
  const fmt = (v) => (money ? `₹${Number(v).toLocaleString('en-IN')}` : Number(v).toLocaleString('en-IN'));

  return (
    <div className="px-3 pb-3">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none"
           style={{ width: '100%', height: `${height}px` }} role="img"
           aria-label={`Chart, highest ${fmt(max)}`}>
        {points.map((p, i) => {
          const h = (p.value / max) * (height - 10);
          return (
            <rect key={i} x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={h}
                  fill={color} rx="0.6">
              <title>{`${p.label}: ${fmt(p.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="d-flex justify-content-between small text-secondary">
        <span>{points[0].label}</span>
        <span>peak: {fmt(max)}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  );
}
