import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FEATURE_CATEGORIES } from '@/data/features';
import { useApi } from '@/lib/api';
import { shrinkPhoto, toBase64 } from '@/lib/image';
import { PLAN_LABELS, PLANS } from '@/lib/plans';
import type { Plan } from '@/types';

type Osm = { id: string; name: string; address: string | null; phone: string | null; website: string | null; hours: string | null; features: string[] };
type Override = {
  name: string | null; address: string | null; phone: string | null; website: string | null; hours: string | null;
  description: string | null; features: string[] | null; prices: Partial<Record<Plan, number>>; hidden: boolean;
};
type Image = { id: string; alt: string | null };
type Loaded = { osm: Osm; override: Override | null; images: Image[] };

type Form = {
  name: string; address: string; phone: string; website: string; hours: string; description: string;
  prices: Record<Plan, string>; hidden: boolean; features: string[] | null; // null = the map's features
};

function toForm(o: Override | null): Form {
  const prices = Object.fromEntries(PLANS.map(p => [p, o?.prices[p] ? String(o.prices[p]) : ''])) as Record<Plan, string>;
  return {
    name: o?.name ?? '', address: o?.address ?? '', phone: o?.phone ?? '', website: o?.website ?? '', hours: o?.hours ?? '',
    description: o?.description ?? '', prices, hidden: o?.hidden ?? false, features: o?.features ?? null,
  };
}

export default function AdminGymEdit() {
  const { gymId = '' } = useParams();
  const { admin } = useApi();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await admin.get<Loaded>('gyms', { id: gymId });
      setLoaded(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this gym.");
      return null;
    }
  }, [admin, gymId]);

  useEffect(() => {
    void load().then(result => { if (result) setForm(toForm(result.override)); });
  }, [load]);

  if (!loaded || !form) {
    return error ? <p className="field-error" role="alert">{error}</p> : <p className="listing-empty">Loading…</p>;
  }
  const { osm, images } = loaded;
  const f = form;

  const text = (key: 'name' | 'address' | 'phone' | 'website' | 'hours') => ({
    value: f[key],
    placeholder: osm[key] ?? 'Not listed on the map',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...f, [key]: e.target.value }),
  });

  const effectiveFeatures = f.features ?? osm.features;
  function toggleFeature(id: string) {
    const next = new Set(effectiveFeatures);
    if (next.has(id)) next.delete(id); else next.add(id);
    setForm({ ...f, features: Array.from(next) });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNote('');
    try {
      const prices: Record<string, number> = {};
      for (const p of PLANS) {
        const raw = f.prices[p].trim();
        if (!raw) continue;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1) throw new Error(`${PLAN_LABELS[p]} price must be a whole number of rupees.`);
        prices[p] = n;
      }
      await admin.put('gyms', { id: gymId }, { ...f, prices });
      setNote('Saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    try {
      await admin.del('gyms', { id: gymId });
      setConfirmReset(false);
      setForm(toForm(null));
      setNote('Reset to the map data. Photos were kept.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't reset.");
    }
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const data = await toBase64(await shrinkPhoto(file));
      await admin.post('images', { gymId, contentType: 'image/jpeg', data, alt });
      setAlt('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  async function move(id: string, direction: 'up' | 'down') {
    try {
      await admin.patch('images', { id, move: direction });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't move that photo.");
    }
  }

  async function removeImage(id: string) {
    try {
      await admin.del('images', { id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that photo.");
    }
  }

  return (
    <>
      <Link className="admin-back" to="/admin/gyms"><ArrowLeft size={16} /> All gyms</Link>
      <h1 className="admin-title">{f.name || osm.name}</h1>
      <p className="muted">Gym id {gymId}. Empty fields use the map's data. <Link className="gd-link" to={`/gym/${gymId}`}>View public page</Link></p>
      {error && <p className="field-error" role="alert">{error}</p>}
      {note && <p className="admin-note" role="status">{note}</p>}

      <form className="admin-form" onSubmit={save}>
        <section className="admin-section">
          <h2>Details</h2>
          <div className="admin-grid">
            <label>Name<input type="text" maxLength={120} {...text('name')} /></label>
            <label>Phone<input type="text" maxLength={40} {...text('phone')} /></label>
            <label className="wide">Address<input type="text" maxLength={200} {...text('address')} /></label>
            <label>Website<input type="url" maxLength={300} {...text('website')} /></label>
            <label>Opening hours<input type="text" maxLength={200} {...text('hours')} /></label>
            <label className="wide">Description
              <textarea rows={4} maxLength={2000} value={f.description} onChange={e => setForm({ ...f, description: e.target.value })} placeholder="Shown on the gym page. Leave empty for an automatic summary." />
            </label>
          </div>
        </section>

        <section className="admin-section">
          <h2>Prices (₹ per person)</h2>
          <p className="muted">A plan can be booked only once it has a price. Without one, a sample price is shown and booking is off.</p>
          <div className="admin-grid prices">
            {PLANS.map(p => (
              <label key={p}>{PLAN_LABELS[p]}
                <input type="number" min={1} max={1000000} step={1} inputMode="numeric" value={f.prices[p]} placeholder="Not set" onChange={e => setForm({ ...f, prices: { ...f.prices, [p]: e.target.value } })} />
              </label>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="gd-row">
            <h2>Features</h2>
            {f.features !== null && <button type="button" className="gd-link" onClick={() => setForm({ ...f, features: null })}>Use the map's features</button>}
          </div>
          <p className="muted">{f.features === null ? "Showing what the map lists. Change a box to set your own list." : 'Your own list is used instead of the map.'}</p>
          {FEATURE_CATEGORIES.map(cat => (
            <fieldset key={cat.title} className="admin-features">
              <legend>{cat.title}</legend>
              {cat.features.map(feat => (
                <label key={feat.id}>
                  <input type="checkbox" checked={effectiveFeatures.includes(feat.id)} onChange={() => toggleFeature(feat.id)} /> {feat.label}
                </label>
              ))}
            </fieldset>
          ))}
        </section>

        <section className="admin-section">
          <h2>Visibility</h2>
          <label className="admin-check"><input type="checkbox" checked={f.hidden} onChange={e => setForm({ ...f, hidden: e.target.checked })} /> Hide this gym from search and from users</label>
        </section>

        <div className="admin-save">
          <button type="submit" className="pill-button compact" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          {confirmReset ? (
            <>
              <button type="button" className="gd-link danger" onClick={reset}>Confirm reset</button>
              <button type="button" className="gd-link" onClick={() => setConfirmReset(false)}>Keep my edits</button>
            </>
          ) : (
            <button type="button" className="gd-link" onClick={() => setConfirmReset(true)}>Reset to map data</button>
          )}
        </div>
      </form>

      <section className="admin-section">
        <h2>Photos ({images.length} of 10)</h2>
        <p className="muted">The first photo is the main one. Photos are resized in your browser before upload.</p>
        <ul className="admin-photos">
          {images.map((img, i) => (
            <li key={img.id}>
              <img src={`/api/image?id=${img.id}`} alt={img.alt ?? ''} loading="lazy" />
              <span className="muted">{img.alt ?? 'No description'}</span>
              <div className="admin-row-actions">
                <button type="button" className="gd-link" onClick={() => move(img.id, 'up')} disabled={i === 0}>Move up</button>
                <button type="button" className="gd-link" onClick={() => move(img.id, 'down')} disabled={i === images.length - 1}>Move down</button>
                <button type="button" className="gd-link danger" onClick={() => removeImage(img.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {images.length < 10 && (
          <div className="admin-upload">
            <label>Description (optional)<input type="text" maxLength={160} value={alt} onChange={e => setAlt(e.target.value)} placeholder="e.g. Free weights area" /></label>
            <label className="pill-button compact upload-button">
              {uploading ? 'Uploading…' : 'Add a photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={uploading} hidden />
            </label>
          </div>
        )}
      </section>
    </>
  );
}
