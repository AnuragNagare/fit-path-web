import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SignIn, SignUp } from '@clerk/react';
import { Dumbbell } from 'lucide-react';

type Mode = 'signin' | 'signup';

// Only paths inside this site are allowed, so a sign-in link can never send someone to another site.
function safeNext(value: string | null): string {
  return value && /^\/[A-Za-z0-9/_-]*$/.test(value) && !value.startsWith('//') ? value : '/plan';
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signin');
  const next = safeNext(useSearchParams()[0].get('next'));

  return (
    <div className="site auth-page">
      {/* Left panel — branding */}
      <div className="auth-brand-panel" aria-hidden="true">
        <div className="auth-brand-inner">
          <a className="brand" href="/">FitPath</a>
          <p className="auth-brand-tagline">Find gyms wherever<br />you go.</p>
          <svg className="auth-route-svg" viewBox="0 0 520 400" fill="none">
            <path d="M-20 320 C80 300 120 160 240 140 C360 120 340 240 460 210 C560 185 580 80 720 60"
              stroke="#FF5A0F" strokeWidth="2.5" strokeDasharray="13 15" />
            <circle cx="240" cy="140" r="8" fill="#FF5A0F" />
            <circle cx="460" cy="210" r="8" fill="#FF5A0F" />
          </svg>
          <div className="auth-stats">
            <div><strong>500+</strong><span>Gyms mapped</span></div>
            <div><strong>10 km</strong><span>Search radius</span></div>
          </div>
        </div>
      </div>

      {/* Right panel — Clerk form */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          {/* Mobile logo */}
          <a className="brand auth-mobile-logo" href="/">FitPath</a>

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
            <SignIn routing="hash" forceRedirectUrl={next} />
          ) : (
            <SignUp routing="hash" forceRedirectUrl={next} />
          )}

          <div className="auth-icon-row">
            <Dumbbell size={16} />
            <span>Find gyms in any area</span>
          </div>
        </div>
      </div>
    </div>
  );
}
