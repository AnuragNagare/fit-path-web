import { countGymsInIndia } from './_lib/geo.js';
import type { ApiRequest, ApiResponse } from './_lib/http.js';

const DAY_S = 24 * 60 * 60;

// Kept per server instance; Vercel's CDN cache (below) is what keeps the slow query to about once a day.
let cached: { gymCount: number; at: number } | null = null;
let pending: Promise<number> | null = null;

// GET /api/stats  ->  { gymCount }  (public: used by the landing page)
export default async function handler(_req: ApiRequest, res: ApiResponse) {
  try {
    if (!cached || Date.now() - cached.at > DAY_S * 1000) {
      // Share one in-flight lookup between concurrent requests.
      pending ??= countGymsInIndia().finally(() => { pending = null; });
      cached = { gymCount: await pending, at: Date.now() };
    }
    res.setHeader('Cache-Control', `public, s-maxage=${DAY_S}, stale-while-revalidate=${7 * DAY_S}`);
    res.status(200).json({ gymCount: cached.gymCount });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'Gym count unavailable right now.' });
  }
}
