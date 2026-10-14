import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api, store } from './api.js';
import { useAuth, useCan } from './auth.jsx';
import { Modal, Spinner, useToast } from './ui/index.jsx';
import Login from './Login.jsx';

import Dashboard     from './pages/Dashboard.jsx';
import Analytics     from './pages/Analytics.jsx';
import Users         from './pages/Users.jsx';
import Reports       from './pages/Reports.jsx';
import Messages      from './pages/Messages.jsx';
import Plans         from './pages/Plans.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import Coins         from './pages/Coins.jsx';
import Payments      from './pages/Payments.jsx';
import Channels      from './pages/Channels.jsx';
import Boosts        from './pages/Boosts.jsx';
import Stickers      from './pages/Stickers.jsx';
import Announcements from './pages/Announcements.jsx';
import Settings      from './pages/Settings.jsx';
import Audit         from './pages/Audit.jsx';
import Admins        from './pages/Admins.jsx';

// route → page + which permission it needs
export const ROUTES = [
  { section: 'Overview' },
  { path: '/',              title: 'Dashboard',     icon: 'speedometer2',   el: <Dashboard />,     perm: ['users.view'] },
  { path: '/analytics',     title: 'Analytics',     icon: 'graph-up',       el: <Analytics />,     perm: ['payments.view', 'plans.view', 'users.view'] },

  { section: 'People' },
  { path: '/users',         title: 'Users',         icon: 'people',         el: <Users />,         perm: ['users.view'] },
  { path: '/reports',       title: 'Reports',       icon: 'flag',           el: <Reports />,       perm: ['reports.view'] },
  { path: '/messages',      title: 'Chats',         icon: 'chat-left-text', el: <Messages />,      perm: ['messages.view'] },

  { section: 'Money' },
  { path: '/plans',         title: 'Plans',         icon: 'card-checklist', el: <Plans />,         perm: ['plans.view'] },
  { path: '/subscriptions', title: 'Subscriptions', icon: 'person-check',   el: <Subscriptions />, perm: ['plans.view'] },
  { path: '/coins',         title: 'Coins',         icon: 'coin',           el: <Coins />,         perm: ['coins.view'] },
  { path: '/payments',      title: 'Payments',      icon: 'credit-card',    el: <Payments />,      perm: ['payments.view'] },

  { section: 'Content' },
  { path: '/channels',      title: 'Channels',      icon: 'broadcast',      el: <Channels />,      perm: ['channels.view'] },
  { path: '/boosts',        title: 'Boosts',        icon: 'rocket',         el: <Boosts />,        perm: ['channels.view'] },
  { path: '/stickers',      title: 'Stickers',      icon: 'emoji-smile',    el: <Stickers />,      perm: ['stickers.manage'] },
  { path: '/announcements', title: 'Announcements', icon: 'megaphone',      el: <Announcements />, perm: ['announcements.manage'] },

  { section: 'System' },
  { path: '/settings',      title: 'Settings',      icon: 'sliders',        el: <Settings />,      perm: ['settings.view'] },
  { path: '/audit',         title: 'Audit log',     icon: 'clock-history',  el: <Audit />,         perm: ['audit.view'] },
  { path: '/admins',        title: 'Admin users',   icon: 'shield-lock',    el: <Admins />,        perm: ['admins.manage'] },
];

const pages = ROUTES.filter((r) => r.path);

function ChangePassword({ onClose }) {
  const { toast, showError } = useToast();
  const [busy, setBusy] = useState(false);

  const submit = async (v) => {
    if (v.newPassword !== v.confirm) return showError(new Error('The two new passwords do not match'));
    setBusy(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: v.currentPassword, newPassword: v.newPassword,
      });
      toast('Password changed');
      onClose();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Change password" onClose={onClose} onSubmit={submit} confirmText="Change" busy={busy}>
      <label className="form-label">Current password</label>
      <input name="currentPassword" type="password" className="form-control mb-3" required />
      <label className="form-label">New password</label>
      <input name="newPassword" type="password" className="form-control mb-1" required minLength={8} />
      <div className="form-text mb-3">At least 8 characters.</div>
      <label className="form-label">New password again</label>
      <input name="confirm" type="password" className="form-control" required minLength={8} />
    </Modal>
  );
}

/** A clear answer on a page you cannot open — not a blank screen */
function Denied({ perm }) {
  return (
    <div className="alert alert-warning">
      <i className="bi bi-shield-lock me-2" />
      You do not have permission for this page (<code>{perm.join(', ')}</code>).
    </div>
  );
}

export default function App() {
  const { me, state, signOut } = useAuth();
  const can = useCan();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // On a small screen the menu closes when the page changes — otherwise it hangs around
  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);

  if (state === 'checking') return <Spinner text="Checking your session…" />;
  if (state !== 'in') return <Login />;

  const visible = ROUTES.filter((r) => !r.path || !r.perm || can(...r.perm));

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* ── Navbar ── */}
      <nav className="navbar navbar-dark bg-dark sticky-top flex-nowrap px-3" style={{ height: 56 }}>
        <button className="btn btn-dark d-lg-none px-2" onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu">
          <i className="bi bi-list fs-4" />
        </button>
        <span className="navbar-brand mb-0 h1 fs-5">
          <i className="bi bi-gear-fill text-primary me-2" />
          Telebook Admin
        </span>
        <span className="text-white-50 small d-none d-md-inline ms-auto me-3">
          {store.base.replace(/^https?:\/\//, '')}
        </span>
        <div className="dropdown ms-auto ms-md-0">
          <button className="btn btn-outline-light btn-sm dropdown-toggle" data-bs-toggle="dropdown"
                  onClick={(e) => {
                    // No Bootstrap JS here, so the dropdown is handled by hand
                    const m = e.currentTarget.nextElementSibling;
                    m.classList.toggle('show');
                  }}>
            <i className="bi bi-person-circle me-1" />
            {me?.name || me?.email}
          </button>
          <ul className="dropdown-menu dropdown-menu-end"
              onClick={(e) => e.currentTarget.classList.remove('show')}>
            <li className="dropdown-header small">
              {me?.role} · {(me?.permissions || []).length} permissions
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item" onClick={() => setShowPw(true)}>
                <i className="bi bi-key me-2" />Change password
              </button>
            </li>
            <li>
              <button className="dropdown-item text-danger" onClick={() => signOut()}>
                <i className="bi bi-box-arrow-right me-2" />Sign out
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <div className="d-flex flex-grow-1">
        {/* ── Sidebar ── */}
        {menuOpen && <div className="tb-sidebar-backdrop d-lg-none" onClick={() => setMenuOpen(false)} />}
        <aside className={`tb-sidebar py-2 ${menuOpen ? 'open' : ''}`}>
          {visible.map((r, i) =>
            r.section ? (
              <div key={`s${i}`} className="tb-nav-section">{r.section}</div>
            ) : (
              <NavLink key={r.path} to={r.path} end={r.path === '/'}
                       className={({ isActive }) => `tb-nav-link ${isActive ? 'active' : ''}`}>
                <i className={`bi bi-${r.icon}`} />
                {r.title}
              </NavLink>
            )
          )}
        </aside>

        {/* ── Page ── */}
        <main className="tb-main p-3 p-lg-4">
          <Routes>
            {pages.map((r) => (
              <Route key={r.path} path={r.path}
                     element={r.perm && !can(...r.perm) ? <Denied perm={r.perm} /> : r.el} />
            ))}
            <Route path="*" element={
              <div className="alert alert-warning">Page not found.</div>
            } />
          </Routes>
        </main>
      </div>

      {showPw && <ChangePassword onClose={() => setShowPw(false)} />}
    </div>
  );
}
