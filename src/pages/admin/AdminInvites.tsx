import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '@/lib/api';
import { formatDateTime } from './format';

type Invite = {
  id: string;
  label: string;
  status: 'valid' | 'used' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  gymId: string | null;
  ownerName: string | null;
};

const STATUS_TONE = { valid: 'active', used: 'ended', expired: 'ended', cancelled: 'cancelled' } as const;
const STATUS_LABEL = { valid: 'Waiting', used: 'Used', expired: 'Expired', cancelled: 'Cancelled' } as const;

export default function AdminInvites() {
  const { admin } = useApi();
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ label: string; link: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setInvites((await admin.get<{ invites: Invite[] }>('invites')).invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the links.");
    }
  }, [admin]);

  useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    setCopied(false);
    try {
      const r = await admin.post<{ token: string; invite: { label: string; expiresAt: string } }>('invites', { label });
      setFresh({ label: r.invite.label, link: `${window.location.origin}/register/${r.token}`, expiresAt: r.invite.expiresAt });
      setLabel('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the link.");
    } finally {
      setCreating(false);
    }
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.link);
      setCopied(true);
    } catch {
      setError('Copy failed. Select the link and copy it yourself.');
    }
  }

  async function cancel(id: string) {
    try {
      await admin.del('invites', { id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel the link.");
    }
  }

  return (
    <>
      <h1 className="admin-title">Registration links</h1>
      <p className="muted">Send a link to a gym so it can register itself. Each link works once, for one gym, and expires after 14 days.</p>
      {error && <p className="field-error" role="alert">{error}</p>}

      <section className="admin-section">
        <h2>Create a link</h2>
        <form className="admin-search" onSubmit={create}>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} maxLength={80} required placeholder='Who is it for? e.g. "FitZone, Pune"' aria-label="Label" />
          <button type="submit" className="pill-button compact" disabled={creating}>{creating ? 'Creating…' : 'Create link'}</button>
        </form>
        {fresh && (
          <div className="invite-fresh" role="status">
            <strong>Link for {fresh.label}</strong>
            <input type="text" readOnly value={fresh.link} onFocus={e => e.target.select()} aria-label="Registration link" />
            <div className="review-actions">
              <button type="button" className="pill-button compact" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
              <span className="muted">Expires {formatDateTime(fresh.expiresAt)}. This is the only time the full link is shown, so copy it now.</span>
            </div>
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>All links</h2>
        {!invites && !error && <p className="listing-empty">Loading…</p>}
        {invites?.length === 0 && <p className="listing-empty">No links yet.</p>}
        {invites && invites.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>For</th><th>Status</th><th>Created</th><th>Expires</th><th>Used by</th><th /></tr></thead>
              <tbody>
                {invites.map(i => (
                  <tr key={i.id}>
                    <td><strong>{i.label}</strong></td>
                    <td><span className={`status-badge status-badge--${STATUS_TONE[i.status]}`}>{STATUS_LABEL[i.status]}</span></td>
                    <td className="muted">{formatDateTime(i.createdAt)}</td>
                    <td className="muted">{formatDateTime(i.expiresAt)}</td>
                    <td>{i.gymId ? <Link className="gd-link" to={`/admin/registrations/${i.gymId}`}>{i.ownerName}</Link> : <span className="muted">Not yet</span>}</td>
                    <td>{i.status === 'valid' && <button type="button" className="gd-link danger" onClick={() => cancel(i.id)}>Cancel link</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
