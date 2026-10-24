import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { Building2, Camera, Check, Clock, Sparkles, Star, Users } from 'lucide-react';
import { checkInvite, useApi } from '@/lib/api';
import type { InviteCheck } from '@/types';

const PROBLEMS: Record<string, string> = {
  used: 'This link has already been used.',
  expired: 'This link has expired.',
  cancelled: 'This link was cancelled.',
  unknown: "This link isn't valid.",
};

export default function RegisterGym() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuth();
  const { vendor } = useApi();
  const [invite, setInvite] = useState<InviteCheck | null>(null);
  const [error, setError] = useState('');
  const [claimingTier, setClaimingTier] = useState<'free' | 'paid' | null>(null);
  const [paidRequested, setPaidRequested] = useState(false);

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

  async function claim(tier: 'free' | 'paid') {
    setClaimingTier(tier);
    setError('');
    try {
      await vendor.claim(token, tier);
      if (tier === 'paid') {
        setPaidRequested(true);
      } else {
        navigate('/vendor', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set up your gym. Please try again.");
    } finally {
      setClaimingTier(null);
    }
  }

  const valid = invite?.status === 'valid';

  return (
    <main className="site register-page">
      <a className="brand" href="/" aria-label="FitPath home">Fit<span>Path</span></a>

      {!invite && !error && (
        <div className="register-card">
          <span className="auth-spinner" />
          <p>Verifying your registration link…</p>
        </div>
      )}

      {invite && !valid && (
        <div className="register-card">
          <span className="register-icon"><Building2 size={28} /></span>
          <h1>{PROBLEMS[invite.status] ?? PROBLEMS.unknown}</h1>
          <p>Ask FitPath for a new registration link.</p>
          <Link className="gd-link" to="/">Go to FitPath</Link>
        </div>
      )}

      {/* Confirmation screen when Paid Managed Setup is selected */}
      {paidRequested && (
        <div className="register-paid-success">
          <div className="register-paid-success__icon">
            <Sparkles size={36} />
          </div>
          <h1>Managed Setup Request Received!</h1>
          <p className="register-paid-success__sub">
            Our team has been notified and will contact you within <strong>24 hours</strong> to schedule the on-site visit to your gym.
          </p>

          <div className="register-paid-summary">
            <div className="register-paid-summary__row">
              <span>Selected Option</span>
              <strong>Managed On-Site Setup (VIP Package)</strong>
            </div>
            <div className="register-paid-summary__row">
              <span>Package Price</span>
              <strong>₹15,000 INR</strong>
            </div>
            <div className="register-paid-summary__row">
              <span>Payment Collection</span>
              <span>Offline upon team visit (Invoice / UPI / Bank transfer)</span>
            </div>
            <div className="register-paid-summary__row">
              <span>What's Next</span>
              <span>FitPath creative team visits your gym, captures professional photos & sets up your full profile</span>
            </div>
          </div>

          <button
            type="button"
            className="pill-button book-submit"
            onClick={() => navigate('/vendor', { replace: true })}
          >
            Go to my dashboard →
          </button>
        </div>
      )}

      {/* Main Tier Selection Screen */}
      {valid && !paidRequested && (
        <div className="register-container">
          <div className="register-header">
            <span className="register-icon"><Building2 size={28} /></span>
            <h1>Register your gym on FitPath</h1>
            {invite.label && <p className="register-label">Invitation for: <strong>{invite.label}</strong></p>}
            <p className="register-desc">
              Choose how you would like to onboard your gym. You can build your profile yourself for free, or let our professional team visit on-site and set everything up for you.
            </p>
          </div>

          {error && <p className="field-error" role="alert">{error}</p>}

          <div className="register-tiers-grid">
            {/* Free Tier Card */}
            <div className="register-tier-card">
              <div className="register-tier-card__header">
                <span className="register-tier-badge">Self-Serve</span>
                <h2 className="register-tier-title">Free Profile</h2>
                <div className="register-tier-price">
                  <span className="register-tier-amount">₹0</span>
                  <span className="register-tier-period">Free forever</span>
                </div>
                <p className="register-tier-summary">
                  Build and manage your gym profile yourself at your own pace from the vendor dashboard.
                </p>
              </div>

              <ul className="register-tier-perks">
                <li><Check size={16} className="tier-check" /> <span>Add gym description, hours & contact info</span></li>
                <li><Check size={16} className="tier-check" /> <span>Pin location accurately on map</span></li>
                <li><Check size={16} className="tier-check" /> <span>Upload your own photos & promo videos</span></li>
                <li><Check size={16} className="tier-check" /> <span>Set custom pass prices (Day, Month, Year)</span></li>
                <li><Check size={16} className="tier-check" /> <span>Select facilities and amenities checklist</span></li>
                <li><Check size={16} className="tier-check" /> <span>Receive bookings and view reviews</span></li>
              </ul>

              <div className="register-tier-action">
                {isLoaded && isSignedIn ? (
                  <button
                    type="button"
                    className="pill-button register-btn register-btn--secondary"
                    onClick={() => claim('free')}
                    disabled={claimingTier !== null}
                  >
                    {claimingTier === 'free' ? 'Setting up…' : 'Start Free Profile'}
                  </button>
                ) : (
                  <Link
                    className="pill-button register-btn register-btn--secondary"
                    to={`/auth?next=${encodeURIComponent(`/register/${token}`)}`}
                  >
                    Sign in to Start Free
                  </Link>
                )}
              </div>
            </div>

            {/* Paid Tier Card */}
            <div className="register-tier-card register-tier-card--featured">
              <div className="register-tier-card__banner">
                <Sparkles size={14} /> Full Service On-Site Setup
              </div>
              <div className="register-tier-card__header">
                <span className="register-tier-badge register-tier-badge--pro">VIP Managed</span>
                <h2 className="register-tier-title">Done-For-You Partner</h2>
                <div className="register-tier-price">
                  <span className="register-tier-amount">₹15,000</span>
                  <span className="register-tier-period">One-time fee · Pay on visit</span>
                </div>
                <p className="register-tier-summary">
                  Sit back while our creative & onboarding team visits your gym on-site and sets up your entire profile for maximum customer conversions.
                </p>
              </div>

              <ul className="register-tier-perks">
                <li><Star size={16} className="tier-star" /> <strong>Our team comes to your gym on-site</strong></li>
                <li><Camera size={16} className="tier-star" /> <strong>Professional photography & video shoot</strong></li>
                <li><Check size={16} className="tier-star" /> <strong>Detailed description & bio written for you</strong></li>
                <li><Check size={16} className="tier-star" /> <strong>Equipment & facilities categorized accurately</strong></li>
                <li><Check size={16} className="tier-star" /> <strong>Pass pricing strategy set up for you</strong></li>
                <li><Users size={16} className="tier-star" /> <strong>Assisted review moderation & ongoing management</strong></li>
                <li><Clock size={16} className="tier-star" /> <strong>Dedicated priority support & partner badge</strong></li>
              </ul>

              <div className="register-tier-action">
                {isLoaded && isSignedIn ? (
                  <button
                    type="button"
                    className="pill-button register-btn register-btn--primary"
                    onClick={() => claim('paid')}
                    disabled={claimingTier !== null}
                  >
                    {claimingTier === 'paid' ? 'Sending request…' : 'Request Managed Setup (₹15,000)'}
                  </button>
                ) : (
                  <Link
                    className="pill-button register-btn register-btn--primary"
                    to={`/auth?next=${encodeURIComponent(`/register/${token}`)}`}
                  >
                    Sign in to Request Managed Setup
                  </Link>
                )}
                <p className="register-note">Nothing charged online — pay ₹15,000 upon on-site team visit.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
