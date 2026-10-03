import { useAuth } from '@clerk/react';
import { useCallback } from 'react';
import type { Gym, Place, RouteQuery, SearchResult } from '@/types';

type Params = Record<string, string | number>;

// Returns fetchers for the /api functions that attach the signed-in user's Clerk token.
export function useApi() {
  const { getToken } = useAuth();

  const get = useCallback(
    async <T,>(path: string, params: Params): Promise<T> => {
      const token = await getToken();
      const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
      const res = await fetch(`/api/${path}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!res.ok) throw new Error(body?.error ?? 'Something went wrong. Please try again.');
      return body as T;
    },
    [getToken],
  );

  const geocode = useCallback(
    async (q: string): Promise<Place> => {
      const r = await get<{ lat: number; lon: number; displayName: string }>('geocode', { q });
      return { label: q, lat: r.lat, lon: r.lon };
    },
    [get],
  );

  const searchGyms = useCallback(
    async (query: RouteQuery): Promise<SearchResult> => {
      const params: Params = { fromLat: query.from.lat, fromLon: query.from.lon };
      if (query.to) {
        params.toLat = query.to.lat;
        params.toLon = query.to.lon;
      }
      return get<SearchResult>('gyms', params);
    },
    [get],
  );

  const getGym = useCallback((id: string) => get<Gym>('gym', { id }), [get]);

  return { geocode, searchGyms, getGym };
}
