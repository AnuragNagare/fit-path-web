import { useCallback, useState } from 'react';
import type { Place, RouteQuery } from '@/types';

// Saved in localStorage so they survive refreshes, closed tabs and browser restarts.
// clearStoredData() wipes them on sign-out.
const QUERY_KEY = 'trace:last-search';
const FEATURES_KEY = 'trace:features';
const SAVED_GYMS_KEY = 'trace:saved-gyms';
const DEALS_KEY = 'trace:deals';

// What the user did with a gym's deal on its profile page.
export type DealChoice = { plan: DealPlan; status: 'locked' | 'interested' };
export type DealPlan = 'month' | 'day' | 'trial';

function isPlace(value: unknown): value is Place {
  const p = value as Place | null;
  return !!p && typeof p.label === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

function readQuery(): RouteQuery | null {
  try {
    const q = JSON.parse(localStorage.getItem(QUERY_KEY) ?? 'null') as RouteQuery | null;
    if (!q || !isPlace(q.from) || (q.to !== null && !isPlace(q.to))) return null;
    if (typeof q.startDate !== 'string' || typeof q.endDate !== 'string' || !Number.isFinite(q.people)) return null;
    return q;
  } catch {
    return null;
  }
}

function readFeatures(): Set<string> {
  try {
    const ids = JSON.parse(localStorage.getItem(FEATURES_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

export function clearStoredData() {
  for (const key of [QUERY_KEY, FEATURES_KEY, SAVED_GYMS_KEY, DEALS_KEY]) localStorage.removeItem(key);
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

// The last search, so a refresh on /map re-runs it.
export function useStoredQuery() {
  const [query, setQueryState] = useState<RouteQuery | null>(readQuery);

  const setQuery = useCallback((next: RouteQuery | null) => {
    if (next) localStorage.setItem(QUERY_KEY, JSON.stringify(next));
    else localStorage.removeItem(QUERY_KEY);
    setQueryState(next);
  }, []);

  return [query, setQuery] as const;
}

// The feature filters picked on /map.
export function useStoredFeatures() {
  const [features, setFeaturesState] = useState<Set<string>>(readFeatures);

  const setFeatures = useCallback((update: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setFeaturesState(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      localStorage.setItem(FEATURES_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  return [features, setFeatures] as const;
}

// Gyms saved with the heart button on the profile page.
export function useSavedGym(gymId: string) {
  const [saved, setSavedState] = useState(() => readJson<string[]>(SAVED_GYMS_KEY, []).includes(gymId));

  const toggle = useCallback(() => {
    const ids = readJson<string[]>(SAVED_GYMS_KEY, []).filter(id => id !== gymId);
    if (!saved) ids.push(gymId);
    localStorage.setItem(SAVED_GYMS_KEY, JSON.stringify(ids));
    setSavedState(!saved);
  }, [gymId, saved]);

  return [saved, toggle] as const;
}

// The deal locked, or the interest shown, for one gym.
export function useDeal(gymId: string) {
  const [deal, setDealState] = useState<DealChoice | null>(() => readJson<Record<string, DealChoice>>(DEALS_KEY, {})[gymId] ?? null);

  const setDeal = useCallback((next: DealChoice | null) => {
    const all = readJson<Record<string, DealChoice>>(DEALS_KEY, {});
    if (next) all[gymId] = next; else delete all[gymId];
    localStorage.setItem(DEALS_KEY, JSON.stringify(all));
    setDealState(next);
  }, [gymId]);

  return [deal, setDeal] as const;
}
