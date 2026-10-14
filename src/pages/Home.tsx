import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Dumbbell, MapPin, Play, Search, Star } from 'lucide-react';
import { UserButton, useUser } from '@clerk/react';

const gymImages = [
  'https://images.pexels.com/photos/9545914/pexels-photo-9545914.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/12250460/pexels-photo-12250460.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/5750886/pexels-photo-5750886.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
];

// Illustration only: example cards inside the phone mock-up.
const exampleGyms = [
  { name: 'IronFit Fitness', rating: '4.6', distance: '2.1 km', image: gymImages[0] },
  { name: 'Prime Performance', rating: '4.4', distance: '3.2 km', image: gymImages[1] },
  { name: 'FitZone Gym', rating: '4.2', distance: '4.8 km', image: gymImages[2] },
];

// Real count of gyms in India (OpenStreetMap), rounded down: 4,189 -> "4,100+".
function useGymCount() {
  const [label, setLabel] = useState<string | null | undefined>(undefined); // undefined = loading, null = unavailable
  useEffect(() => {
    let cancelled = false;
    fetch('/api/stats')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('stats unavailable'))))
      .then((data: { gymCount: number }) => {
        if (cancelled) return;
        const rounded = data.gymCount >= 100 ? Math.floor(data.gymCount / 100) * 100 : data.gymCount;
        setLabel(`${rounded.toLocaleString('en-IN')}+`);
      })
      .catch(() => { if (!cancelled) setLabel(null); });
    return () => { cancelled = true; };
  }, []);
  return label;
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useUser();
  const gymCount = useGymCount();
  const startPath = user ? '/plan' : '/auth';

  // Scroll the window directly: `.site` has overflow hidden, which makes scrollIntoView a no-op here.
  function scrollToId(id: string) {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 16, behavior: 'smooth' });
  }

  return (
    <main className="site">
      <header className="topbar">
        <a className="brand" href="/" aria-label="FitPath home">Fit<span>Path</span></a>
        <nav className="nav" aria-label="Main navigation">
          <button type="button" className="active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button>
          <button type="button" onClick={() => scrollToId('features')}>Features</button>
          <button type="button" onClick={() => scrollToId('about')}>About</button>
        </nav>
        <div className="top-actions">
          {user ? (
            <>
              <button className="pill-button compact" type="button" onClick={() => navigate('/plan')}>
                Find gyms <Play size={15} fill="currentColor" />
              </button>
              <UserButton />
            </>
          ) : (
            <button className="pill-button compact" type="button" onClick={() => navigate('/auth')}>
              Get Started <Play size={15} fill="currentColor" />
            </button>
          )}
        </div>
      </header>

      <section className="hero" id="home">
        <svg className="hero-route" viewBox="0 0 1536 700" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <path className="hero-route-ahead" d="M765 192 C880 120 1060 150 1230 170 S1430 100 1540 104" vectorEffect="non-scaling-stroke" />
          <path className="hero-route-done" d="M312 180 C390 222 440 236 540 233 C640 230 700 222 765 192" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="hero-route-dot" aria-hidden="true" />

        <div className="hero-copy">
          <p className="eyebrow">Gym discovery</p>
          <h1>Find<br />gyms<br /><span>wherever</span><br />you go.</h1>
          <p className="lede">Opening hours, facilities and contact details for gyms in any area, or within 10 km of where you are right now.</p>
          <button className="pill-button hero-button" onClick={() => navigate(startPath)}>
            Find gyms near me <Play size={22} fill="currentColor" />
          </button>
        </div>

        <div className="hero-visual" aria-label="FitPath app preview">
          <div className="phone">
            <div className="phone-screen">
              <div className="phone-search"><Search size={13} /> <span>Gyms near me</span><Search size={13} /></div>
              <ArrowLeft className="phone-back" size={15} />
              <div className="map-area">
                <svg className="phone-map" viewBox="0 0 300 170" fill="none" aria-hidden="true">
                  <path d="M-10 40 L120 70 L180 20 M60 170 L95 60 L150 110 L310 80 M200 170 L230 95 L310 120 M150 110 L170 170" stroke="#D5DAE2" strokeWidth="5" />
                  <path d="M-10 120 C60 100 90 140 140 130 M240 -10 L265 60 L310 50" stroke="#E4E8EE" strokeWidth="3" />
                  <path d="M120 95 C140 70 160 60 185 55 C200 52 205 42 210 34" stroke="#FF5A0F" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="120" cy="95" r="8" fill="#ffffff" stroke="#FF5A0F" strokeWidth="4" />
                  <circle cx="211" cy="33" r="8" fill="#ffffff" stroke="#FF5A0F" strokeWidth="4" />
                </svg>
              </div>
            </div>
            <div className="gym-list">
              {exampleGyms.map(gym => (
                <article className="gym-card" key={gym.name}>
                  <img src={gym.image} alt={`${gym.name} interior`} />
                  <div className="gym-info">
                    <strong>{gym.name}</strong>
                    <em>{gym.rating} <Star size={10} fill="currentColor" /></em>
                    <span><MapPin size={10} /> {gym.distance} <i /> <b>Open now</b></span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="feature-list" id="features">
          <div><MapPin /><span>Search any area<br />or use your location</span></div>
          <div><Camera /><span>Real details<br />from OpenStreetMap</span></div>
          <div><Star /><span>Filter by the<br />facilities you need</span></div>
          <div><Dumbbell /><span>Find a gym<br />wherever you are</span></div>
        </aside>
      </section>

      <section className="stats" id="stats">
        {gymCount !== null && (
          <div>
            <strong>{gymCount ?? <span className="stat-loading">—</span>}</strong>
            <span>Gyms mapped in India</span>
          </div>
        )}
        <div><strong>10km</strong><span>Near-you radius</span></div>
      </section>

      <section className="bottom-prompt" id="about">
        <p className="eyebrow">Your area. Your rhythm.</p>
        <h2>Make every mile<br /><em>count.</em></h2>
        <p className="about-copy">Type an area like Bandra, or leave the search empty. FitPath shows the gyms within 10 km, so a workout fits into your day.</p>
        <button className="text-link" onClick={() => navigate(startPath)}>Start exploring <Play size={14} fill="currentColor" /></button>
      </section>
    </main>
  );
}
