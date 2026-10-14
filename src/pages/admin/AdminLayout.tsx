import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { useApi } from '@/lib/api';

const links = [
  { to: '/admin', label: 'Bookings', end: true },
  { to: '/admin/gyms', label: 'Gyms', end: false },
  { to: '/admin/registrations', label: 'Registrations', end: false },
  { to: '/admin/invites', label: 'Links', end: false },
  { to: '/admin/reviews', label: 'Reviews', end: false },
];

export default function AdminLayout() {
  const { admin } = useApi();
  const { pathname } = useLocation();
  const [pending, setPending] = useState(0);

  // The number of gyms waiting for approval, refreshed as the admin moves between pages.
  useEffect(() => {
    let cancelled = false;
    admin.get<{ pendingRegistrations: number }>('stats').then(s => { if (!cancelled) setPending(s.pendingRegistrations); }).catch(() => {});
    return () => { cancelled = true; };
  }, [admin, pathname]);

  return (
    <div className="site admin-site">
      <header className="admin-header">
        <a className="brand" href="/" aria-label="FitPath home">Fit<span>Path</span></a>
        <span className="admin-tag">Admin</span>
        <nav className="admin-nav" aria-label="Admin sections">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {l.label}
              {l.to === '/admin/registrations' && pending > 0 && <span className="nav-count" aria-label={`${pending} waiting`}>{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="admin-header-right">
          <a className="header-link" href="/plan">Back to app</a>
          <UserButton />
        </div>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
