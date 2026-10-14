import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { Building2 } from 'lucide-react';
import { checkInvite, useApi } from '@/lib/api';
import type { InviteCheck } from '@/types';

const PROBLEMS: Record<string, string> = {
  used: 'This link has already been used.',
  expired: 'This link has expired.',
  cancelled: 'This link was cancelled.',
  unknown: "This link isn't valid.",
};

// A gym opens the link the admin shared with them: sign in, then the gym profile is created for their account.
export default function RegisterGym() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { vendor } = useApi();
  const [invite, setInvite] = useState<InviteCheck | null>(null);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkInvite(token)
      .then(result => { if (!cancelled) setInvite(result); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't check this link."); });
    return () => { cancelled = true; };
  }, [token]);

  // A gym owner who opens a link again goes straight to their dashboard.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    vendor.me().then(gym => { if (!cancelled && gym) navigate('/vendor', { replace: true }); }).catch(() => {});
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, vendor, navigate]);

  async function claim() {
    setClaiming(true);
    setError('');
    try {
      await vendor.claim(token);
      navigate('/vendor', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set up your gym. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  const valid = invite?.status === 'valid';

  return (
    <main className="site register-page">
      <a className="brand" href="/" aria-label="FitPath home">Fit<span>Path</span></a>
      <div className="register-card">
        <span className="register-icon"><Building2 size={28} /></span>
        {!invite && !error && <span className="auth-spinner" />}
        {invite && !valid && (
          <>
            <h1>{PROBLEMS[invite.status] ?? PROBLEMS.unknown}</h1>
            <p>Ask FitPath for a new registration link.</p>
            <Link className="gd-link" to="/">Go to FitPath</Link>
          </>
        )}
        {valid && (
          <>
            <h1>Register your gym on FitPath</h1>
            {invite.label && <p className="register-label">{invite.label}</p>}
            <p>Add your gym's details, photos and videos. FitPath checks every profile before it goes live, and you can keep it up to date from your own dashboard.</p>
            {isLoaded && isSignedIn ? (
              <button type="button" className="pill-button book-submit" onClick={claim} disabled={claiming}>
                {claiming ? 'Setting up…' : 'Create my gym profile'}
              </button>
            ) : (
              <Link className="pill-button book-submit" to={`/auth?next=${encodeURIComponent(`/register/${token}`)}`}>
                Sign in or create an account to continue
              </Link>
            )}
            <p className="book-note">This link works once and belongs to the account you use here.</p>
          </>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </main>
  );
}
