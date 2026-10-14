import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/react';
import { useApi } from '@/lib/api';
import type { VendorGym, VendorState } from '@/types';
import type { VendorContext } from './useVendor';

const links = [
  { to: '/vendor', label: 'Profile', end: true },
  { to: '/vendor/bookings', label: 'Bookings', end: false },
  { to: '/vendor/reviews', label: 'Reviews', end: false },
];

const BANNERS: Record<VendorState, { tone: 'info' | 'ok' | 'warn' | 'bad'; title: string; text: string }> = {
  draft: { tone: 'info', title: 'Not submitted yet', text: 'Fill in your profile, add photos, then submit it for approval. Customers can find your gym once FitPath approves it.' },
  waiting: { tone: 'info', title: 'Waiting for approval', text: 'FitPath is checking your gym. You can still look around, but changing anything takes it out of the queue until you submit again.' },
  live: { tone: 'ok', title: 'Your gym is live', text: 'Customers can find and book it. Any change you make is checked by FitPath before it goes live.' },
  live_pending: { tone: 'info', title: 'Changes waiting for approval', text: 'Customers still see your approved profile until FitPath approves your changes.' },
  changes_requested: { tone: 'warn', title: 'Changes requested', text: '' },
  suspended: { tone: 'bad', title: 'Your gym is hidden', text: 'FitPath has taken your gym offline for now, so customers cannot find or book it. Contact FitPath to find out why.' },
};

export default function VendorLayout() {
  const { vendor } = useApi();
  const [gym, setGym] = useState<VendorGym | null | undefined>(undefined);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setGym(await vendor.me());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your gym.");
    }
  }, [vendor]);

  useEffect(() => { void load(); }, [load]);

  if (gym === undefined && !error) return <div className="site auth-loading"><span className="auth-spinner" /></div>;

  if (!gym) {
    return (
      <main className="site gym-page">
        <div className="gym-not-found">
          <h1>No gym profile yet</h1>
          <p>{error || 'Open the registration link FitPath sent you to create your gym profile.'}</p>
          <Link className="pill-button gd-cta" to="/plan">Back to FitPath</Link>
        </div>
      </main>
    );
  }

  const banner = BANNERS[gym.state];
  return (
    <div className="site admin-site">
      <header className="admin-header">
        <a className="brand" href="/" aria-label="FitPath home">Fit<span>Path</span></a>
        <span className="admin-tag">Gym owner</span>
        <nav className="admin-nav" aria-label="Gym sections">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="admin-header-right">
          <a className="header-link" href="/plan">Back to app</a>
          <UserButton />
        </div>
      </header>
      <main className="admin-main">
        <div className={`vendor-banner vendor-banner--${banner.tone}`} role="status">
          <strong>{banner.title}</strong>
          <p>{gym.state === 'changes_requested' ? gym.reviewNote : banner.text}</p>
          {gym.state === 'changes_requested' && <p className="muted">Fix this, then submit again.</p>}
        </div>
        <Outlet context={{ gym, setGym } satisfies VendorContext} />
      </main>
    </div>
  );
}
