import type { ApiRequest, ApiResponse } from './_lib/http.js';

const HOUR_S = 60 * 60;
const DAY_S = 24 * HOUR_S;
const REFRESH_S = 6 * HOUR_S;

// Free daily rates, no API key. Prices in the app are in INR, so INR is the base.
const RATES_URL = 'https://open.er-api.com/v6/latest/INR';

type Rates = { base: 'INR'; rates: Record<string, number>; updated: string };

// Kept per server instance; the CDN cache header below keeps upstream calls to a few a day.
let cached: { data: Rates; at: number } | null = null;

async function fetchRates(): Promise<Rates> {
  const res = await fetch(RATES_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error('rates request failed');
  const body = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
  if (body.result !== 'success' || !body.rates) throw new Error('rates unavailable');
  return { base: 'INR', rates: body.rates, updated: body.time_last_update_utc ?? '' };
}

// GET /api/rates  ->  { base: 'INR', rates: { USD: 0.0105, ... }, updated }  (public: shown on the price display)
export default async function handler(_req: ApiRequest, res: ApiResponse) {
  try {
    if (!cached || Date.now() - cached.at > REFRESH_S * 1000) {
      try {
        cached = { data: await fetchRates(), at: Date.now() };
      } catch (err) {
        if (!cached) throw err; // otherwise keep serving the last good rates
      }
    }
    res.setHeader('Cache-Control', `public, s-maxage=${REFRESH_S}, stale-while-revalidate=${DAY_S}`);
    res.status(200).json(cached.data);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'Exchange rates unavailable right now.' });
  }
}
