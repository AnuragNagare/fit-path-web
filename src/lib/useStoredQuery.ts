import { useCallback, useState } from 'react';
import type { Place, SearchQuery } from '@/types';

// Saved in localStorage so they survive refreshes, closed tabs and browser restarts.
// clearStoredData() wipes them on sign-out.
const QUERY_KEY = 'trace:last-search';
const FEATURES_KEY = 'trace:features';
const SAVED_GYMS_KEY = 'trace:saved-gyms';

function isPlace(value: unknown): value is Place {
  const p = value as Place | null;
  return !!p && typeof p.label === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon);
}

// A search saved by an older version (From/To) has no `place`, so it is dropped here.
function readQuery(): SearchQuery | null {
  try {
    const q = JSON.parse(localStorage.getItem(QUERY_KEY) ?? 'null') as SearchQuery | null;
    if (!q || !isPlace(q.place)) return null;
    if (!Number.isFinite(q.people)) return null;
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
  for (const key of [QUERY_KEY, FEATURES_KEY, SAVED_GYMS_KEY, 'trace:deals']) localStorage.removeItem(key); // 'trace:deals' is from an older version
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
  const [query, setQueryState] = useState<SearchQuery | null>(readQuery);

  const setQuery = useCallback((next: SearchQuery | null) => {
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
