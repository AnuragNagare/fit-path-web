import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FEATURE_LABELS } from '@/data/features';
import { useApi } from '@/lib/api';
import { PLAN_LABELS, PLANS } from '@/lib/plans';
import type { VendorGym, VendorProfile } from '@/types';
import { formatDateTime, inr } from './format';
import { STATE_LABEL, STATE_TONE } from './states';

type Detail = { gym: VendorGym; owner: { name: string; email: string }; changes: string[]; bookings: number };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function rows(p: VendorProfile | null): { key: string; label: string; value: string }[] {
  const dash = '–';
  return [
    { key: 'name', label: 'Name', value: p?.name ?? dash },
    { key: 'address', label: 'Address', value: p?.address ?? dash },
    { key: 'location', label: 'Location', value: p && p.lat !== null && p.lon !== null ? `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}` : dash },
    { key: 'phone', label: 'Phone', value: p?.phone ?? dash },
    { key: 'website', label: 'Website', value: p?.website ?? dash },
    { key: 'hours', label: 'Opening hours', value: p?.hours ?? dash },
    { key: 'description', label: 'Description', value: p?.description ?? dash },
    { key: 'features', label: 'Features', value: p?.features.length ? p.features.map(f => FEATURE_LABELS[f] ?? f).join(', ') : dash },
    { key: 'prices', label: 'Prices', value: p && Object.keys(p.prices).length ? PLANS.filter(plan => p.prices[plan]).map(plan => `${PLAN_LABELS[plan]}: ${inr(p.prices[plan]!)}`).join(' · ') : dash },
  ];
}

export default function AdminRegistrationDetail() {
  const { gymId = '' } = useParams();
  const { admin } = useApi();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    try {
      setDetail(await admin.get<Detail>('registrations', { id: gymId }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this gym.");
    }
  }, [admin, gymId]);

  useEffect(() => { void load(); }, [load]);

  async function decide(action: 'approve' | 'reject' | 'suspend' | 'reinstate', message: string) {
    setBusy(true);
    setError('');
    setDone('');
    try {
      await admin.patch('registrations', { id: gymId, action, note: action === 'reject' ? note : undefined });
      setDone(message);
      setRejecting(false);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your decision.");
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return error ? <p className="field-error" role="alert">{error}</p> : <p className="listing-empty">Loading…</p>;

  const { gym, owner, changes } = detail;
  const waiting = gym.submittedAt !== null;
  const live = rows(gym.live);
  const draft = rows(gym.draft);
  const photos = gym.media.filter(m => m.kind === 'photo');
  const videos = gym.media.filter(m => m.kind === 'video');

  return (
    <>
      <Link className="admin-back" to="/admin/registrations"><ArrowLeft size={16} /> All gyms</Link>
      <h1 className="admin-title">{gym.draft.name ?? gym.live?.name ?? 'Unnamed gym'}</h1>
      <p className="muted">
        <span className={`status-badge status-badge--${STATE_TONE[gym.state]}`}>{STATE_LABEL[gym.state]}</span>{' '}
        Owner: {owner.name} ({owner.email}) · {detail.bookings} {detail.bookings === 1 ? 'booking' : 'bookings'}
        {gym.reviewCount > 0 && ` · rating ${gym.rating} from ${gym.reviewCount}`}
        {gym.submittedAt && ` · submitted ${formatDateTime(gym.submittedAt)}`}
      </p>
      {gym.reviewNote && <p className="muted">Your last note to the owner: "{gym.reviewNote}"</p>}
      {error && <p className="field-error" role="alert">{error}</p>}
      {done && <p className="admin-note" role="status">{done}</p>}

      {waiting && (
        <p className="admin-note">
          {gym.live ? `Changes to review: ${changes.join(', ') || 'photos or videos only'}.` : 'This is the first submission. The gym is not visible to customers yet.'}
        </p>
      )}

      <section className="admin-section">
        <h2>{gym.live ? 'Live version and the owner\'s draft' : 'Owner\'s draft'}</h2>
        <div className="admin-table-wrap">
          <table className="admin-table compare-table">
            <thead><tr><th>Field</th>{gym.live && <th>Live now</th>}<th>{gym.live ? 'Draft' : 'Submitted'}</th></tr></thead>
            <tbody>
              {draft.map((d, i) => {
                const l = live[i];
                const changed = Boolean(gym.live) && !same(gym.live && l.value, d.value);
                return (
                  <tr key={d.key} className={changed ? 'is-changed' : ''}>
                    <th scope="row">{d.label}{changed && <span className="media-state media-state--pending_add">Changed</span>}</th>
                    {gym.live && <td>{l.value}</td>}
                    <td>{d.value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section">
        <h2>Photos and videos</h2>
        {gym.media.length === 0 && <p className="listing-empty">No photos or videos.</p>}
        <ul className="admin-photos">
          {[...photos, ...videos].map(m => (
            <li key={m.id} className={m.state === 'pending_remove' ? 'is-removing' : ''}>
              {m.kind === 'photo' ? <img src={m.url} alt={m.alt ?? ''} loading="lazy" /> : <video src={m.url} controls preload="metadata" playsInline aria-label={m.alt ?? 'Video'} />}
              <span className={`media-state media-state--${m.state}`}>{m.state === 'live' ? 'Live' : m.state === 'pending_add' ? 'New' : 'Owner wants it removed'}</span>
              <span className="muted">{m.alt ?? 'No description'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section">
        <h2>Decision</h2>
        <div className="admin-save">
          {waiting && (
            <>
              <button type="button" className="pill-button compact" onClick={() => decide('approve', gym.live ? 'Approved. The changes are live.' : 'Approved. The gym is now live.')} disabled={busy}>Approve</button>
              {!rejecting && <button type="button" className="gd-link danger" onClick={() => setRejecting(true)} disabled={busy}>Reject with a note</button>}
            </>
          )}
          {gym.status === 'live' && <button type="button" className="gd-link danger" onClick={() => decide('suspend', 'Suspended. The gym is hidden from customers.')} disabled={busy}>Suspend gym</button>}
          {gym.status === 'suspended' && <button type="button" className="pill-button compact" onClick={() => decide('reinstate', 'Reinstated. The gym is visible again.')} disabled={busy}>Reinstate gym</button>}
          {!waiting && gym.status !== 'live' && gym.status !== 'suspended' && <span className="muted">Nothing to decide until the owner submits.</span>}
        </div>
        {rejecting && (
          <div className="admin-review-edit">
            <label className="admin-note-label">What should the owner fix? They will see this note.
              <textarea rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Please add a clearer photo of the entrance." />
            </label>
            <div className="review-actions">
              <button type="button" className="pill-button compact" onClick={() => decide('reject', 'Sent back to the owner with your note.')} disabled={busy || !note.trim()}>Send back</button>
              <button type="button" className="gd-link" onClick={() => { setRejecting(false); setNote(''); }}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
