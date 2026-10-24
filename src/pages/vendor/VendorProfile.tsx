import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { FEATURE_CATEGORIES } from '@/data/features';
import { useApi } from '@/lib/api';
import { PLAN_LABELS, PLANS } from '@/lib/plans';
import type { Plan, VendorProfile as Profile } from '@/types';
import VendorMedia from './VendorMedia';
import { useVendor } from './useVendor';

type Form = {
  name: string; address: string; lat: number | null; lon: number | null; phone: string; website: string; hours: string;
  description: string; features: string[]; prices: Record<Plan, string>;
};

const toForm = (p: Profile): Form => ({
  name: p.name ?? '', address: p.address ?? '', lat: p.lat, lon: p.lon, phone: p.phone ?? '', website: p.website ?? '', hours: p.hours ?? '',
  description: p.description ?? '', features: p.features,
  prices: Object.fromEntries(PLANS.map(plan => [plan, p.prices[plan] ? String(p.prices[plan]) : ''])) as Record<Plan, string>,
});

function toProfile(f: Form): Profile {
  const prices: Profile['prices'] = {};
  for (const plan of PLANS) {
    const raw = f.prices[plan].trim();
    if (!raw) continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${PLAN_LABELS[plan]} price must be a whole number of rupees.`);
    prices[plan] = n;
  }
  return {
    name: f.name, address: f.address, lat: f.lat, lon: f.lon, phone: f.phone, website: f.website, hours: f.hours,
    description: f.description, features: f.features, prices,
  };
}

function PinPicker({ lat, lon, onPick }: { lat: number; lon: number; onPick: (lat: number, lon: number) => void }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lon], Math.max(map.getZoom(), 15)); }, [lat, lon, map]);
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) });
  return <CircleMarker center={[lat, lon]} radius={10} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#FF5A0F', fillOpacity: 1 }} />;
}

export default function VendorProfile() {
  const { gym, setGym } = useVendor();
  const { vendor, geocode } = useApi();
  const [form, setForm] = useState<Form>(() => toForm(gym.draft));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'save' | 'submit' | 'locate' | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => ({ ...f, [key]: value }));
  const text = (key: 'name' | 'address' | 'phone' | 'website' | 'hours') => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value) });

  async function locate() {
    if (!form.address.trim()) { setError('Type the address first.'); return; }
    setBusy('locate');
    setError('');
    try {
      const place = await geocode(form.address.trim());
      setForm(f => ({ ...f, lat: place.lat, lon: place.lon }));
      setNote('Location found. Click the map to move the pin if it is not exactly right, then save.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't find that address.");
    } finally {
      setBusy(null);
    }
  }

  async function save(thenSubmit: boolean) {
    setBusy(thenSubmit ? 'submit' : 'save');
    setError('');
    setNote('');
    try {
      let updated = await vendor.saveDraft(toProfile(form));
      setGym(updated);
      if (thenSubmit) {
        updated = await vendor.submit();
        setGym(updated);
        setNote('Sent to FitPath for approval.');
      } else {
        setNote('Saved. This is not sent to FitPath until you submit it.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  }

  function toggleFeature(id: string) {
    set('features', form.features.includes(id) ? form.features.filter(f => f !== id) : [...form.features, id]);
  }

  const submitted = gym.state === 'waiting' || gym.state === 'live_pending';

  return (
    <>
      <h1 className="admin-title">Your gym</h1>
      {gym.tier === 'paid' && (
        <div className="vendor-tier-banner" role="status">
          <div className="vendor-tier-banner__header">
            <span className="vendor-tier-banner__badge">★ ₹15,000 Paid Setup Requested</span>
            {gym.tierRequestedAt && (
              <span className="vendor-tier-banner__date">
                Requested on {new Date(gym.tierRequestedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <p className="vendor-tier-banner__text">
            <strong>VIP On-Site Setup Active:</strong> Our FitPath team will come to your gym, shoot professional photos, write descriptions, add details, and set up your verified profile.
          </p>
          <p className="vendor-tier-banner__subtext">
            You can still update any details below or upload images anytime, or leave it entirely to our team when they visit.
          </p>
        </div>
      )}
      {gym.live && gym.hasChanges && (
        <p className="muted">Customers currently see: <strong>{gym.live.name}</strong>{gym.live.address ? `, ${gym.live.address}` : ''}. Your changes below are not public until approved.</p>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
      {note && <p className="admin-note" role="status">{note}</p>}

      <form className="admin-form" onSubmit={e => { e.preventDefault(); void save(false); }}>
        <section className="admin-section">
          <h2>Details</h2>
          <div className="admin-grid">
            <label>Gym name<input type="text" maxLength={120} required {...text('name')} /></label>
            <label>Phone<input type="tel" maxLength={40} {...text('phone')} /></label>
            <label>Website<input type="url" maxLength={300} placeholder="https://" {...text('website')} /></label>
            <label>Opening hours<input type="text" maxLength={200} placeholder="e.g. Mon to Sat 6am to 10pm" {...text('hours')} /></label>
            <label className="wide">Description
              <textarea rows={4} maxLength={2000} value={form.description} onChange={e => set('description', e.target.value)} placeholder="What makes your gym worth visiting?" />
            </label>
          </div>
        </section>

        <section className="admin-section">
          <h2>Location</h2>
          <div className="admin-search">
            <input type="text" maxLength={240} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address, e.g. 12 MG Road, Pune" aria-label="Address" />
            <button type="button" className="pill-button compact" onClick={locate} disabled={busy !== null}>{busy === 'locate' ? 'Finding…' : 'Find on map'}</button>
          </div>
          {form.lat !== null && form.lon !== null ? (
            <>
              <div className="vendor-map">
                <MapContainer center={[form.lat, form.lon]} zoom={15} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <PinPicker lat={form.lat} lon={form.lon} onPick={(lat, lon) => setForm(f => ({ ...f, lat, lon }))} />
                </MapContainer>
              </div>
              <p className="muted">The orange dot is where customers will be sent. Click the map to move it.</p>
            </>
          ) : (
            <p className="muted">Type your address and choose "Find on map" to place your gym.</p>
          )}
        </section>

        <section className="admin-section">
          <h2>Prices (₹ per person)</h2>
          <p className="muted">Customers can book a plan only if you set its price. Leave a plan empty if you don't offer it.</p>
          <div className="admin-grid prices">
            {PLANS.map(plan => (
              <label key={plan}>{PLAN_LABELS[plan]}
                <input type="number" min={1} max={1000000} step={1} inputMode="numeric" value={form.prices[plan]} placeholder="Not offered" onChange={e => set('prices', { ...form.prices, [plan]: e.target.value })} />
              </label>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <h2>Features</h2>
          {FEATURE_CATEGORIES.map(cat => (
            <fieldset key={cat.title} className="admin-features">
              <legend>{cat.title}</legend>
              {cat.features.map(feat => (
                <label key={feat.id}><input type="checkbox" checked={form.features.includes(feat.id)} onChange={() => toggleFeature(feat.id)} /> {feat.label}</label>
              ))}
            </fieldset>
          ))}
        </section>

        <div className="admin-save">
          <button type="submit" className="gd-link" disabled={busy !== null}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className="pill-button compact" onClick={() => save(true)} disabled={busy !== null || submitted}>
            {busy === 'submit' ? 'Submitting…' : submitted ? 'Submitted' : 'Submit for approval'}
          </button>
        </div>
        {!submitted && gym.problems.length > 0 && (
          <ul className="vendor-problems" aria-label="Still to do">
            {gym.problems.map(p => <li key={p}>{p}</li>)}
          </ul>
        )}
      </form>

      <VendorMedia />
    </>
  );
}
