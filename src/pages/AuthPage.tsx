import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import { Dumbbell } from 'lucide-react';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin');

  return (
    <div className="site auth-page">
      {/* Left panel — branding */}
      <div className="auth-brand-panel" aria-hidden="true">
        <div className="auth-brand-inner">
          <a className="brand" href="/">Trace</a>
          <p className="auth-brand-tagline">Find gyms wherever<br />you go.</p>
          <svg className="auth-route-svg" viewBox="0 0 520 400" fill="none">
            <path d="M-20 320 C80 300 120 160 240 140 C360 120 340 240 460 210 C560 185 580 80 720 60"
              stroke="#b8ff14" strokeWidth="2.5" strokeDasharray="13 15" />
            <circle cx="240" cy="140" r="8" fill="#b8ff14" />
            <circle cx="460" cy="210" r="8" fill="#b8ff14" />
          </svg>
          <div className="auth-stats">
            <div><strong>500+</strong><span>Gyms mapped</span></div>
            <div><strong>3 km</strong><span>Route radius</span></div>
            <div><strong>4.6★</strong><span>Avg. rating</span></div>
          </div>
        </div>
      </div>

      {/* Right panel — Clerk form */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          {/* Mobile logo */}
          <a className="brand auth-mobile-logo" href="/">Trace</a>

          <div className="auth-tab-row">
            <button
              className={`auth-tab${mode === 'signin' ? ' auth-tab--active' : ''}`}
              type="button"
              onClick={() => setMode('signin')}
            >
              Sign in
            </button>
            <button
              className={`auth-tab${mode === 'signup' ? ' auth-tab--active' : ''}`}
              type="button"
              onClick={() => setMode('signup')}
            >
              Create account
            </button>
          </div>

          {mode === 'signin' ? (
            <SignIn routing="hash" forceRedirectUrl="/plan" />
          ) : (
            <SignUp routing="hash" forceRedirectUrl="/plan" />
          )}

          <div className="auth-icon-row">
            <Dumbbell size={16} />
            <span>Route-based gym discovery</span>
          </div>
        </div>
      </div>
    </div>
  );
}
