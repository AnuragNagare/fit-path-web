import { useAuth } from '@clerk/react';
import { upload } from '@vercel/blob/client';
import { useCallback, useMemo } from 'react';
import type {
  Booking, Gym, InviteCheck, Place, Plan, ReviewsResult, SearchQuery, SearchResult, VendorBooking, VendorGym, VendorProfile,
} from '@/types';

type Params = Record<string, string | number | undefined>;
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Anyone can check whether a registration link still works, signed in or not.
export async function checkInvite(token: string): Promise<InviteCheck> {
  const res = await fetch(`/api/vendor?${new URLSearchParams({ resource: 'invite', token })}`);
  if (!res.ok) throw new Error('Could not check this link. Please try again.');
  return (await res.json()) as InviteCheck;
}

// Returns fetchers for the /api functions that attach the signed-in user's Clerk token.
export function useApi() {
  const { getToken } = useAuth();

  // One request helper for everything: JSON in, JSON out, errors as Error(message).
  const request = useCallback(
    async <T,>(method: Method, path: string, params: Params = {}, body?: unknown): Promise<T> => {
      const token = await getToken();
      const qs = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])));
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(`/api/${path}?${qs}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!res.ok) throw new Error(data?.error ?? 'Something went wrong. Please try again.');
      return data as T;
    },
    [getToken],
  );

  const geocode = useCallback(
    async (q: string): Promise<Place> => {
      const r = await request<{ lat: number; lon: number; displayName: string }>('GET', 'geocode', { q });
      return { label: q, lat: r.lat, lon: r.lon };
    },
    [request],
  );

  const searchGyms = useCallback(
    (query: SearchQuery) => request<SearchResult>('GET', 'gyms', { lat: query.place.lat, lon: query.place.lon }),
    [request],
  );

  const getGym = useCallback((id: string) => request<Gym>('GET', 'gym', { id }), [request]);

  const bookings = useMemo(
    () => ({
      list: () => request<{ bookings: Booking[] }>('GET', 'bookings').then(r => r.bookings),
      create: (gymId: string, plan: Plan, people: number) =>
        request<{ booking: Booking }>('POST', 'bookings', {}, { gymId, plan, people }).then(r => r.booking),
      cancel: (id: string) => request<{ booking: Booking }>('PATCH', 'bookings', {}, { id }).then(r => r.booking),
    }),
    [request],
  );

  const reviews = useMemo(
    () => ({
      get: (gymId: string) => request<ReviewsResult>('GET', 'reviews', { gymId }),
      save: (gymId: string, rating: number, body: string) => request<{ ok: true }>('POST', 'reviews', {}, { gymId, rating, body }),
      remove: (id: string) => request<{ ok: true }>('DELETE', 'reviews', { id }),
    }),
    [request],
  );

  // Admin calls all go to the one /api/admin function.
  const admin = useMemo(
    () => ({
      get: <T,>(resource: string, params: Params = {}) => request<T>('GET', 'admin', { resource, ...params }),
      put: <T,>(resource: string, params: Params, body: unknown) => request<T>('PUT', 'admin', { resource, ...params }, body),
      post: <T,>(resource: string, body: unknown) => request<T>('POST', 'admin', { resource }, body),
      patch: <T,>(resource: string, body: unknown) => request<T>('PATCH', 'admin', { resource }, body),
      del: <T,>(resource: string, params: Params = {}) => request<T>('DELETE', 'admin', { resource, ...params }),
    }),
    [request],
  );

  // Gym owners: their own gym profile, media, bookings and reviews (the last two are read-only).
  const vendor = useMemo(
    () => ({
      me: () => request<{ gym: VendorGym | null }>('GET', 'vendor', { resource: 'me' }).then(r => r.gym),
      claim: (token: string, tier: 'free' | 'paid' = 'free') =>
        request<{ gym: VendorGym }>('POST', 'vendor', { resource: 'claim' }, { token, tier }).then(r => r.gym),
      saveDraft: (profile: VendorProfile) => request<{ gym: VendorGym }>('PUT', 'vendor', { resource: 'draft' }, profile).then(r => r.gym),
      submit: () => request<{ gym: VendorGym }>('POST', 'vendor', { resource: 'submit' }, {}).then(r => r.gym),
      addMedia: (kind: 'photo' | 'video', url: string, alt: string) =>
        request<{ gym: VendorGym }>('POST', 'vendor', { resource: 'media' }, { kind, url, alt }).then(r => r.gym),
      removeMedia: (id: string) => request<{ gym: VendorGym }>('DELETE', 'vendor', { resource: 'media', id }).then(r => r.gym),
      bookings: () => request<{ bookings: VendorBooking[] }>('GET', 'vendor', { resource: 'bookings' }).then(r => r.bookings),
      reviews: () =>
        request<{ reviews: { id: string; userName: string; rating: number; body: string | null; createdAt: string }[]; summary: { rating: number | null; reviewCount: number } }>(
          'GET', 'vendor', { resource: 'reviews' },
        ),
      // Sends a file straight to Vercel Blob; the server only hands out a short-lived permission for the owner's own folder.
      uploadFile: async (gymId: string, kind: 'photo' | 'video', file: Blob, name: string) => {
        const token = await getToken();
        const safe = name.replace(/[^A-Za-z0-9._-]/g, '-').slice(-80) || 'file';
        const result = await upload(`vendor/${gymId}/${safe}`, file, {
          access: 'public',
          handleUploadUrl: '/api/vendor?resource=upload',
          clientPayload: JSON.stringify({ token, kind }),
          contentType: file.type || undefined,
        });
        return result.url;
      },
    }),
    [request, getToken],
  );

  return { geocode, searchGyms, getGym, bookings, reviews, admin, vendor };
}
