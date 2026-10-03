# Trace

Find gyms along the road you're driving, or within 3 km of where you are. India only.

- Frontend: Vite + React (`src/`)
- API: Vercel functions (`api/`), using free OpenStreetMap services (Nominatim, OSRM, Overpass)
- Sign-in: Clerk

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your Clerk keys
npm run dev                  # http://localhost:5173 (also serves /api)
```

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel. If it lives inside a larger repo, set **Root Directory** to this folder.
2. Vercel reads `vercel.json`: Vite build into `dist`, functions from `api/`, and a rewrite so app routes like `/map` load on refresh.
3. Add the environment variables from `.env.example` (Production and Preview):
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
4. Deploy. The first visit to the landing page takes about 2 minutes to count gyms in India; after that the count is cached for a day.

For a public launch, create a Clerk **production** instance for your domain and use its keys; the development keys have usage limits.

## Notes

- Ratings, review counts and prices are mock values (`src/lib/mock.ts`) until a real data source is added.
- Saved searches, filters, saved gyms and deals are stored in the browser and cleared on sign-out.
