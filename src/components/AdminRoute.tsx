import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/api';

// Shows its children only to admins. This is for display: every /api/admin call is checked on the server.
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { admin } = useApi();
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    admin.get('me')
      .then(() => { if (!cancelled) setState('allowed'); })
      .catch(() => { if (!cancelled) setState('denied'); });
    return () => { cancelled = true; };
  }, [admin]);

  if (state === 'checking') return <div className="site auth-loading"><span className="auth-spinner" /></div>;
  if (state === 'denied') {
    return (
      <main className="site gym-page">
        <div className="gym-not-found">
          <h1>No access</h1>
          <p>This area is for FitPath admins. If you should have access, sign in with the admin email.</p>
          <Link className="pill-button gd-cta" to="/plan">Back to FitPath</Link>
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
