# FitPath

Find gyms in any area you type, or within 10 km of where you are. Search works for places anywhere in the world; the rest of the app (prices in rupees, India's calendar) is unchanged.

- Frontend: Vite + React (`src/`)
- API: Vercel functions (`api/`), using free OpenStreetMap services (Nominatim, Overpass)
- Sign-in: Clerk
- Database: Neon Postgres (bookings, reviews, gym edits, gym owners and their media records)
- Files: Vercel Blob (gym owner photos and videos)
- Admin area at `/admin` for the emails in `ADMIN_EMAILS`

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your Clerk keys, DATABASE_URL and ADMIN_EMAILS
npm run db:migrate           # creates the tables (safe to run again)
npm run dev                  # http://localhost:5173 (also serves /api)
```

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel. If it lives inside a larger repo, set **Root Directory** to this folder.
2. Vercel reads `vercel.json`: Vite build into `dist`, functions from `api/`, and a rewrite so app routes like `/map` load on refresh.
3. Add the environment variables from `.env.example` (Production and Preview):
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `DATABASE_URL`
   - `ADMIN_EMAILS`
   - `BLOB_READ_WRITE_TOKEN` (photo and video uploads)
4. Run `npm run db:migrate` once against the production database (with its `DATABASE_URL`), and again after any new file appears in `db/migrations/`.
5. Deploy. The first visit to the landing page takes about 2 minutes to count gyms in India; after that the count is cached for a day.

For a public launch, create a Clerk **production** instance for your domain and use its keys; the development keys have usage limits.

## Admin

1. Sign up at `/auth` with an email listed in `ADMIN_EMAILS` and verify it. Anyone else who opens `/admin` is refused, and every admin API call is checked on the server.
2. `/admin` shows bookings (who, which gym, dates, amount, payment and status), `/admin/gyms` edits gym details, prices, features and photos, and `/admin/reviews` edits, hides or deletes reviews.

## Bookings

- Plans: day pass, 1 week, 1 month, 3 months, 6 months, 1 year. The start date is the day of booking and the end date follows the plan, both set by the server (India's calendar).
- A gym can be booked for a plan only after an admin sets that plan's price. Until then the app shows sample prices and booking is off.
- Booking only reserves: the amount is paid at the gym and shows as "due". Admin can mark it paid. Online payment is not built yet.
- Prices are stored in rupees and converted for display with live exchange rates.

## Gym owners

Gyms register themselves, so nobody adds them by hand.

1. In `/admin/invites`, the admin creates a link for a gym (for example "FitZone, Pune") and sends it. A link works once, for one gym, and expires after 14 days. Only a hash of it is stored, so the full link is shown once, right after it is created.
2. The owner opens the link, signs in or signs up, and a gym profile is created for their account. They fill in the name, address (checked on a map), details, features, plan prices, photos and videos at `/vendor`.
3. They press "Submit for approval". The admin sees it in `/admin/registrations` and approves it or sends it back with a note.
4. Once approved, the gym appears in search next to the map gyms and can be booked and reviewed. After that, every edit the owner makes waits for approval too: customers keep seeing the approved version until the admin approves the change.
5. Owners can see their bookings (names, plans, dates, amounts, no emails) and their reviews and rating, but cannot change any of them. The admin can suspend or reinstate a gym at any time.

Photos (up to 10, 5 MB each) and videos (up to 3, 50 MB each) are uploaded straight from the browser to Vercel Blob. Create a Blob store in Vercel (Storage, then Blob), copy its `BLOB_READ_WRITE_TOKEN` into `.env.local` and the Vercel project settings, and uploads start working. Without it, owners see "uploads are not set up yet".

## Tests

- `npm test`: fast unit tests (dates, prices, validation, admin check, gym merge).
- `npm run test:db`: runs the bookings, reviews, admin and image flows against the database in `.env.local`. It creates and removes its own rows only.

## Notes

- Saved searches, filters and saved gyms are stored in the browser and cleared on sign-out.
