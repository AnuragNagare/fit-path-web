import { useCallback, useState } from 'react';
import type { Gym, Place, SearchQuery } from '@/types';

// Saved in localStorage so they survive refreshes, closed tabs and browser restarts.
// clearStoredData() wipes them on sign-out.
const QUERY_KEY = 'trace:last-search';
const FEATURES_KEY = 'trace:features';
const SAVED_GYMS_KEY = 'trace:saved-gyms';
const SEARCH_RESULTS_KEY = 'fitpath:search-results';
const SEARCH_FILTERS_KEY = 'fitpath:search-filters';
const SEARCH_SCROLL_KEY = 'fitpath:search-scroll';

// 30-minute freshness for cached search results
const CACHE_TTL_MS = 30 * 60 * 1000;

export interface StoredFilters {
  sort?: string;
  priceRange?: [number, number];
  minRating?: number | null;
  openNowOnly?: boolean;
}

interface CachedResultsPayload {
  queryKey: string;
  gyms: Gym[];
  timestamp: number;
}

// In-memory cache for instant zero-latency page transitions
let inMemorySearchResults: CachedResultsPayload | null = null;

export function makeQueryKey(q: SearchQuery | null): string {
  if (!q || !q.place) return '';
  return `${q.place.lat.toFixed(4)},${q.place.lon.toFixed(4)}`;
}

export function getCachedSearchResults(query: SearchQuery | null): Gym[] | null {
  if (!query || !query.place) return null;
  const key = makeQueryKey(query);
  if (!key) return null;

  // 1. Check in-memory cache first (immediate)
  if (inMemorySearchResults && inMemorySearchResults.queryKey === key) {
    if (Date.now() - inMemorySearchResults.timestamp < CACHE_TTL_MS) {
      return inMemorySearchResults.gyms;
    }
  }

  // 2. Check localStorage
  try {
    const raw = localStorage.getItem(SEARCH_RESULTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedResultsPayload;
    if (parsed.queryKey === key && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      inMemorySearchResults = parsed;
      return parsed.gyms;
    }
  } catch {
    // ignore
  }

  return null;
}

export function setCachedSearchResults(query: SearchQuery, gyms: Gym[]) {
  const key = makeQueryKey(query);
  if (!key) return;

  const payload: CachedResultsPayload = {
    queryKey: key,
    gyms,
    timestamp: Date.now(),
  };

  inMemorySearchResults = payload;
  try {
    localStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
}

export function getStoredFilters(): StoredFilters | null {
  try {
    const raw = sessionStorage.getItem(SEARCH_FILTERS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredFilters(filters: StoredFilters) {
  try {
    sessionStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    // ignore
  }
}

export function getStoredScrollY(): number {
  try {
    const val = sessionStorage.getItem(SEARCH_SCROLL_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function setStoredScrollY(y: number) {
  try {
    sessionStorage.setItem(SEARCH_SCROLL_KEY, String(Math.max(0, Math.round(y))));
  } catch {
    // ignore
  }
}

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
  for (const key of [
    QUERY_KEY,
    FEATURES_KEY,
    SAVED_GYMS_KEY,
    SEARCH_RESULTS_KEY,
    SEARCH_FILTERS_KEY,
    SEARCH_SCROLL_KEY,
    'trace:deals',
  ]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
  inMemorySearchResults = null;
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
