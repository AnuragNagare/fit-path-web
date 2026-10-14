import { useState } from 'react';
import { useApi } from '@/lib/api';
import { shrinkPhoto } from '@/lib/image';
import type { VendorMedia as Media } from '@/types';
import { useVendor } from './useVendor';

const MAX_PHOTOS = 10;
const MAX_VIDEOS = 3;
const MAX_VIDEO_MB = 50;

const STATE_LABEL: Record<Media['state'], string> = { live: 'Live', pending_add: 'New', pending_remove: 'Being removed' };

export default function VendorMedia() {
  const { gym, setGym } = useVendor();
  const { vendor } = useApi();
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState<'photo' | 'video' | null>(null);
  const [error, setError] = useState('');

  const photos = gym.media.filter(m => m.kind === 'photo');
  const videos = gym.media.filter(m => m.kind === 'video');
  const count = (list: Media[]) => list.filter(m => m.state !== 'pending_remove').length;

  async function add(kind: 'photo' | 'video', e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    if (kind === 'video' && file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`That video is over ${MAX_VIDEO_MB} MB. Choose a shorter or smaller one.`);
      return;
    }
    setBusy(kind);
    try {
      const body = kind === 'photo' ? await shrinkPhoto(file) : file;
      const name = kind === 'photo' ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
      const url = await vendor.uploadFile(gym.id, kind, body, name);
      setGym(await vendor.addMedia(kind, url, alt));
      setAlt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that file. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      setGym(await vendor.removeMedia(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that file.");
    }
  }

  const item = (m: Media) => (
    <li key={m.id} className={m.state === 'pending_remove' ? 'is-removing' : ''}>
      {m.kind === 'photo' ? <img src={m.url} alt={m.alt ?? ''} loading="lazy" /> : <video src={m.url} controls preload="metadata" playsInline aria-label={m.alt ?? 'Video'} />}
      <span className={`media-state media-state--${m.state}`}>{STATE_LABEL[m.state]}</span>
      <span className="muted">{m.alt ?? 'No description'}</span>
      <button type="button" className={`gd-link${m.state === 'pending_remove' ? '' : ' danger'}`} onClick={() => remove(m.id)}>
        {m.state === 'pending_remove' ? 'Keep it' : 'Remove'}
      </button>
    </li>
  );

  return (
    <section className="admin-section">
      <h2>Photos and videos</h2>
      <p className="muted">Photos: JPEG, PNG or WebP, up to {MAX_PHOTOS}. Videos: MP4, WebM or MOV, up to {MAX_VIDEOS} and {MAX_VIDEO_MB} MB each. The first photo is the main one. New files and removals go live when FitPath approves them.</p>
      {error && <p className="field-error" role="alert">{error}</p>}

      <h3 className="admin-sub">Photos ({count(photos)} of {MAX_PHOTOS})</h3>
      <ul className="admin-photos">{photos.map(item)}</ul>
      <h3 className="admin-sub">Videos ({count(videos)} of {MAX_VIDEOS})</h3>
      <ul className="admin-photos">{videos.map(item)}</ul>

      <div className="admin-upload">
        <label>Description (optional)
          <input type="text" maxLength={160} value={alt} onChange={e => setAlt(e.target.value)} placeholder="e.g. Free weights area" />
        </label>
        {count(photos) < MAX_PHOTOS && (
          <label className="pill-button compact upload-button">
            {busy === 'photo' ? 'Uploading…' : 'Add a photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => add('photo', e)} disabled={busy !== null} hidden />
          </label>
        )}
        {count(videos) < MAX_VIDEOS && (
          <label className="pill-button compact upload-button">
            {busy === 'video' ? 'Uploading…' : 'Add a video'}
            <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => add('video', e)} disabled={busy !== null} hidden />
          </label>
        )}
      </div>
    </section>
  );
}
