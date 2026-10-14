# Trace (Bolt) — Real-data plan

Goal: make `/plan` and `/map` (and `/gym/:id`) use real gym data instead of the hard-coded `src/data/gyms.ts`.
Auth is already handled by Clerk (`@clerk/react`).

## Approach
- Free OpenStreetMap services, no API keys: **Nominatim** (geocoding) and **Overpass** (gyms).
- Calls run server-side in `api/*.ts` (Vercel-style functions) to avoid CORS and send a proper User-Agent.
- Every function verifies the Clerk session token (`@clerk/backend`), so only signed-in users can call it.
- In dev, a small Vite plugin serves `/api/*` so `npm run dev` works without the Vercel CLI.
- Ported from the FitPath root app's `src/lib/geo.ts` (retry logic, point-to-segment distance).

## Decisions (defaults, change if needed)
- Geocoding is India-only for now (confirmed by the user), same as FitPath.
- The route follows real driving roads (OSRM public server); gyms within a 3 km corridor of the road are kept. If OSRM is down it falls back to a straight line and the UI says so.

## Phases
1. **Backend** — `api/geocode`, `api/gyms` (A→B corridor search), `api/gym` (single gym by id), Clerk auth check, Vite dev plugin.
2. **Route Planner (`/plan`)** — From + To fields, "use my location", dates, party size; geocode both before searching.
3. **Map View (`/map`)** — load gyms from the API; loading/empty/error states; fit map to route; show A/B and route line.
4. **Features filter** — map OSM tags to the feature ids that OSM can actually answer (sauna, pool, wheelchair, 24/7, showers, lockers, AC, yoga, boxing…); filter for real; mark the rest unavailable.
5. **Gym Details (`/gym/:id`)** — real address, hours, phone, website, features. OSM has no photos/ratings/prices/reviews → hide or clearly placeholder.
6. **Verify** — typecheck, build, live calls to Nominatim/Overpass, full browser flow.

## Needed from the user after the code is done
- (India-only and road route are decided.)
- Test in the browser while signed in with Clerk.
- Deployment access if it should go live (functions need Vercel; add `CLERK_SECRET_KEY` + `VITE_CLERK_PUBLISHABLE_KEY` as env vars).
- Photos/ratings/prices: stay hidden for now (decided); a paid source such as Google Places could be added later.

## Status (round 1)
- [x] Phase 1  - [x] Phase 2  - [x] Phase 3  - [x] Phase 4  - [x] Phase 5  - [ ] Phase 6 (typecheck, lint, build and live OSM calls pass; browser test with a Clerk login still pending)

---

# Round 2 — flow and UI changes (analysis only, nothing implemented yet)

## Requests
1. Remove light mode.
2. Remove the top nav bar (screenshot is the `/map` page).
3. New flow: Get Started → create account / log in → enter From (and optionally To). With a To, show gyms along the route. With no To, ask for the user's location and show gyms within 3 km of them.
4. Marker behaviour: clicking a map pointer must not open the gym profile. It should pop up that gym's summary on top of the map. The gym stays in the list below. Clicking the popup or the list card opens the full profile.
5. `/map` layout stays as it is now: map on top, gym cards below.

## What the code does today (why each change is needed)
- **Light mode:** `isLight`/`setIsLight` state lives in `App.tsx` and is passed to Home, RoutePlanner, MapView and GymDetails (30 references across 6 files). It drives a `.site.light` CSS block and a Sun toggle in each top bar.
- **Top bar:** `<header className="topbar">` with brand, Home/Routes/Features/About links and the theme toggle is rendered on Home, RoutePlanner and MapView. It is the only place Home's "Get Started" and sign-out buttons live.
- **Flow:** `/plan` requires both From and To. "Use my location" only fills From. `api/gyms` requires all four coordinates and always routes A→B. There is no nearby mode.
- **Markers:** `eventHandlers.click` on each `<Marker>` calls `openGym()`, so it navigates straight to `/gym/:id`. The `<Popup>` is never seen, and `FlyTo`/`activeId` was removed in round 1.

## Plan

### A. Remove light mode
- Delete `isLight` state from `App.tsx` and the `isLight`/`setIsLight` props from all four pages.
- Remove the `light` class variants and the Sun toggle button.
- Delete the `.site.light` rules (and any `.light` overrides) in `src/index.css`.
- Result: single dark theme.

### B. Remove the top nav bar (all pages)
- Remove the `topbar` header from Home, `/plan` and `/map` (GymDetails and Auth have their own headers).
- Home: the nav links go away. Keep a "Get Started" button (signed-out) or "Find gyms" (signed-in) in the hero; its existing `navigate('/auth' | '/plan')` logic stays. The sign-out icon moves to the `UserButton`.
- `/plan` and `/map`: show Clerk's `UserButton` (avatar menu with sign out), only when signed in. On `/map` it goes in the context bar; on `/plan` in a top corner. Without the nav there is no link back to Home except the brand/logo, so keep a small "Trace" brand link on `/plan`.
- Home's `#features`/`#about` anchors (nav targets) can stay as page sections; only the links to them are removed.
- Delete the unused `.topbar`, `.nav`, `.top-actions`, `.theme-toggle` CSS afterwards. `.brand` is still used on Auth.

### C. New flow
1. Home → "Get Started" → `/auth` (signed-out) or `/plan` (signed-in). Already works this way.
2. `/plan` (revised):
   - **From:** on page load, ask for browser location and prefill "My location". The user can type a place instead.
   - **To:** optional.
   - Dates and number of people: unchanged (decided).
   - Submit with a To → existing A→B road-route search.
   - Submit without a To → nearby search around From (or current location), radius 3 km.
   - If location is denied and From is empty → inline error asking the user to type a starting point.
3. **Backend (`api/gyms`):** make `toLat`/`toLon` optional. When they are missing, skip OSRM and query Overpass with a single `around:3000,lat,lon`, returning `route: null` (or a `type: 'nearby'` route) with distances measured from the centre point.
4. **Frontend types:** `RouteQuery.to` becomes `Place | null`; `SearchResult.route` becomes nullable.
5. **`/map` for nearby mode:** centre and zoom on the user's point, draw a 3 km circle instead of a route line, replace the "7.5 km · 8 min drive" chip with "Within 3 km of you", and keep the "N gyms found" count and Features filter. The "Change route" button label becomes "Change search".
6. Browser location only works on `https` or `localhost`. That is fine for dev and for Vercel.

### D. Marker → popup → profile
- Marker click sets `activeId` (state in `MapView`) instead of navigating.
- A floating summary card for that gym appears pinned to the top of the map (name, address or "Address not listed", distance from route, top features) with a "View profile" action (decided: overlay card, not a Leaflet bubble). The existing Leaflet `<Popup>` is removed.
- The matching card in the list below is moved to the top of the list (as you described: "that gym pops up on top of the list") and highlighted; the other cards keep their order below it. The map pans to the gym.
- Clicking the summary card, or any list card, navigates to `/gym/:id` (passing the gym and selected features as router state, as now).
- Clicking the map background or a close button dismisses the summary.
- The gym profile page itself is unchanged.

### E. `/map` layout
- Keep: map filling the top area, horizontal gym cards below, context bar with Change route / route info / Features / result count.
- Only edits: the topbar disappears (more map height), the popup/highlight behaviour from D, and the nearby-mode context chip from C.

## Files expected to change
`src/App.tsx`, `src/pages/Home.tsx`, `RoutePlanner.tsx`, `MapView.tsx`, `GymDetails.tsx`, `src/types.ts`, `src/lib/api.ts`, `src/index.css`, `api/gyms.ts`, `api/_lib/geo.ts`, plus a new small hook for the persisted search (e.g. `src/lib/useStoredQuery.ts`).

## Decisions (answered by the user)
1. **Nav removed from every page**, including Home. Home keeps no nav links; its hero "Get Started" button is the entry point.
2. **Clerk UI appears after Get Started.** Interpretation (confirm if wrong): signed-out users see no Clerk UI until they click Get Started, which opens `/auth` (Clerk sign-in/sign-up). Once signed in, Clerk's `UserButton` (avatar + sign out) shows on `/plan` and `/map`, and Home shows "Find gyms" in place of "Get Started" when signed in.
3. **Dates and number of people stay on `/plan` exactly as they are.** No changes to those fields.
4. **Gym summary is a floating card at the top of the map** (not a Leaflet bubble).
5. **Search is remembered across refreshes** (see section F).

### F. Remember the search across refreshes
- Persist the last `RouteQuery` (From, To or none, dates, people) in `sessionStorage`; restore it on load so a refresh on `/map` re-runs the search instead of redirecting to `/plan`.
- Scope: per browser tab, cleared when the tab closes. Cleared on sign-out so the next person on the same browser does not see it.
- If the stored value is missing or invalid, fall back to the current behaviour (redirect `/map` to `/plan`).
- Where: replace the `useState<RouteQuery | null>` in `App.tsx` with a small hook backed by `sessionStorage`. The selected features filter is not persisted; it resets on refresh.
- The nearby search with "My location" stores the coordinates it used, so a refresh does not re-prompt for location.

## Risks
- Overpass is a public free server and can rate-limit; nearby mode is a lighter query than corridor mode, so it should be faster.
- Browser location prompts can be dismissed or blocked; the typed-From fallback must always work.
- Removing `isLight` touches every page, so a full typecheck, lint and browser pass is needed afterwards.

## Status (round 2)
- [x] A Remove light mode  - [x] B Remove top nav  - [x] C New flow + nearby mode  - [x] D Marker popup  - [x] E Map layout tweaks  - [x] F Remember search  - [x] Verify
- Verified 2026-10-02: typecheck, lint, build pass. Signed-in browser pass: route search (Andheri → Bandra, 35 gyms, 7.5 km / 8 min), marker → summary card + card moved to top of list, summary → profile, refresh on /map re-runs the saved search, nearby search (Andheri West, 19 gyms in 3 km circle), Home shows "Find gyms" when signed in.
- Fix found while testing: the automatic location request on /plan overwrote a From the user had already typed. Now it only fills an empty From; the "Use my location" button still overrides.
- Not tested: sign-out clearing the saved search; the browser location prompt itself (it stayed pending in the test browser).

## Build order (when approved)
A → B → F (App-level state, touches every page) → C (types + backend + `/plan`) → D + E (`/map`) → verify with typecheck, lint, build, live nearby + route calls, then a signed-in browser pass by the user.

---

# Round 3 — match two reference designs (analysis only, nothing implemented yet)

References (in `Bolt/`):
- Landing: `Trace_ Find Gyms Wherever You Go.png`
- Map page: `Neon Gym Finder Dashboard.png`

## 1. Landing page (`/`) — "exactly like this"

### What the reference shows
- **Top bar:** "Trace" logo (the "ce" in lime), nav links Home / Routes / Features / About with Home underlined in lime, a lime "Get Started ▶" pill, and a sun (theme) icon.
- **Hero, left column:** mono eyebrow "ROUTE-BASED DISCOVERY"; very heavy, wide headline "FIND / GYMS / WHEREVER / YOU GO." with "WHEREVER" in lime; grey lede; large lime pill "FIND GYMS ON MY ROUTE ▶".
- **Hero, centre:** a lime dashed route line that starts beside "GYMS", ends in a lime dot, then continues in grey behind the phone. A phone tilted to the right, showing a search bar "Gyms on my route", a back arrow, a dark map with a short lime route between two lime ring markers, and three gym cards that overflow the phone edge (photo, name, rating with star, distance, "On your route").
- **Hero, right column:** four feature rows with lime outline icons and grey text, separated by thin rules.
- **Stats row:** 500+ Gyms mapped / 3km Near-you radius / 4.6★ Avg. rating, with vertical dividers.

### Difference from today's Home
- Today's Home is already this layout (it came from the same design), so this is a refinement, not a rebuild.
- To fix: headline typeface (the reference is much heavier and wider than Space Grotesk 700; closest free match is **Archivo Black**); logo with a lime "ce"; route line path and lime dot position; phone screen content (back arrow, map with a lime route between two ring markers); gym cards overflowing the phone, with the rating on its own line; CTA arrow style (solid play-triangle); stats row spacing; feature icons (the last one is a dumbbell).
- **Conflict with Round 2:** the reference has the top nav and a theme (sun) icon. Round 2 removed the nav from every page and removed light mode. See question 1.

## 2. Map page (`/map`)

### What the reference shows
- **Header:** no nav links; a bell icon and a profile avatar on the right.
- **Legend pill:** You (blue) / Gyms (white) / Selected (lime).
- **Map:** inset with rounded corners, **dark map style**, blue dot for the user, white pins for gyms, lime pin for the selected gym with a label ("Recently viewed"), a compass button (top right) and a "locate me" button (bottom right).
- **Results header:** "GYMS AROUND YOU" + an "Edit" pill (edit the search), the place name below ("Hinjewadi Phase 3"), and "2 FOUND" on the right.
- **Filter chips inline:** Parking, Shower, Locker, AC (outlined pills), a filter (funnel) icon, and a sort control "CLOSEST".
- **List rows (full width, not a grid):** photo, name, area; on the right: distance (lime, mono), rating ★, Parking • Open, and prices "₹1,499/mo | ₹269/day".
- **Selected row:** green-tinted background with a lime border and a lime "Details" button.
- **Bottom tab bar:** Home, Search, Profile icons, Home active in lime.

### Difference from today's `/map`
- Today: a context bar (Change search, route chips, people, dates, Features button, count, avatar); a light OSM map edge to edge; a floating summary card over the map when a pin is clicked; a 4-column card grid below.
- To change: header (bell + avatar), legend, dark inset map with compass and locate-me buttons, blue "You" marker, results header with Edit and count, inline feature chips + sort, full-width list rows, selected-row highlight with Details, bottom tab bar.
- **Selected gym behaviour:** the reference shows the picked gym as a highlighted row with a "Details" button. That matches your original request ("that gym pops up on top of the list, then clicking it opens the profile"). Proposal: remove the floating summary card added in Round 2; clicking a pin moves that gym's row to the top, highlights it, shows "Details", and scrolls the list to it. See question 4.

### Data the reference shows that we do not have
OpenStreetMap has none of these for most gyms:
- **Photos:** none.
- **Ratings** (4.6★): none.
- **Prices** (₹/mo, ₹/day): none.
- **Area name** ("Hinjewadi"): available for some gyms (`addr:suburb` / `addr:city`); otherwise it can fall back to the searched place name.
- **"Open":** possible only when the gym has `opening_hours` in OSM (parsed with the `opening_hours` npm package); otherwise nothing is shown.
- **Parking:** only when tagged in OSM.

Round 1 decided photos, ratings and prices stay hidden. See question 2.

### Other pieces needing a decision
- **Bell icon:** there is no notifications feature. See question 3.
- **Bottom tab bar:** Home → `/`, Search → `/plan`, Profile → Clerk's account page (`UserProfile`), which needs a new route such as `/profile`. See question 5.
- **Dark map tiles:** OpenStreetMap's default tiles are light. Options: CARTO "Dark Matter" tiles (free for low-volume and non-commercial use; commercial use needs a licence), or darkening the OSM tiles with a CSS filter (free, slightly less crisp). Recommended: CARTO Dark Matter now, revisit before launch. See question 6.
- **Compass button:** Leaflet maps are always north-up and don't rotate, so a compass has nothing to do. Proposal: make it a "reset view" button (re-fit the search area). Locate-me centres on the user's location.
- **Route mode:** the reference is the nearby case ("Gyms around you"). For a From → To search the heading becomes "Gyms on your route", the subtitle "Andheri → Bandra · 7.5 km · 8 min", and the route line is drawn as today.
- **Dates and number of people:** not visible in the reference. Round 2 kept them on `/plan` unchanged; proposal is to keep them only on `/plan` and drop them from the map page. See question 7.
- **Sort:** "Closest" (default, today's order). Other sort options would need data we don't have (rating, price), so the sort control would only offer Closest and A–Z for now.
- **Filter chips:** show the user's selected features as chips (tap to remove); the funnel icon opens the existing feature drawer.
- **Screen size:** the reference is a tablet-width layout. On desktop the same single-column layout is centred with a max width (about 1300px); on mobile the map gets shorter and the price/distance block stacks under the name.

## Is the picture enough?
For layout, colours and components: yes. The questions below still need answers, because the pictures conflict with earlier decisions or show data that doesn't exist.

## Open questions (answer before building)
1. **Landing nav and sun icon:** the reference has the top nav and a theme icon, but Round 2 removed the nav everywhere and removed light mode. Bring the nav back on the landing page only (links scroll to sections or go to `/plan`)? Show the sun icon (it would do nothing) or drop it?
2. **Photos, ratings, prices on `/map`:** keep hidden (rows show name, area, distance, Open, features), show clearly marked placeholders, or add a paid data source (Google Places) for real ones?
3. **Bell icon:** remove it, or keep it as a placeholder with nothing behind it?
4. **Selected gym:** replace the floating summary card with the highlighted row + "Details" button, as in the reference?
5. **Bottom tab bar:** add it (Home, Search, Profile with a new Clerk profile page)? On all screen sizes, or mobile/tablet only?
6. **Dark map:** CARTO Dark Matter tiles (recommended) or a CSS-darkened OSM map?
7. **Dates and people on `/map`:** drop them from the map page (still on `/plan`), or show them under the heading?
8. **Landing gym cards and stats** ("IronFit Fitness 4.6★", "500+ gyms mapped", "4.6★ avg. rating"): these are made-up marketing numbers. Keep them as in the reference, or change them to things that are true?

## Decisions (answered by the user)
1. **Landing nav comes back, and it must work.** Links on the landing page only (the map page has no nav, as in the reference):
   - Home → top of `/`.
   - Routes → `/plan` when signed in, `/auth` when signed out (after sign-in, Clerk already lands on `/plan`).
   - Features → scrolls to the feature list (`#features`).
   - About → scrolls to the "Make every mile count" section (`#about`). That section is hidden on desktop today (`display: none` above 640px), so it must be made visible.
   - Right side: "Get Started" when signed out; "Find gyms" + Clerk avatar (with sign out) when signed in.
   - **Sun icon: still open, see below.**
2. **Stay signed in and keep the data until sign-out.** Clerk already keeps the session across refreshes and browser restarts. What changes is the app data:
   - The last search moves from `sessionStorage` (lost when the tab closes) to `localStorage` (kept until sign-out), so it survives closing the tab or the browser.
   - The selected feature filters are saved the same way (today they reset on refresh).
   - Everything saved is cleared on sign-out; Clerk syncs sign-out across tabs, so every open tab clears.
   - Every signed-in page stays reachable from every other page: landing nav (Routes), `/plan` brand link, `/map` Edit and avatar, gym page back button.
3. **Photos and prices: placeholders.** Rows show a placeholder photo tile and placeholder prices ("₹— /mo | ₹— /day"), styled like the reference, so it is clear they are not real.
4. **No bell icon.** The map page header has only the Clerk avatar.
5. **Selected gym:** the floating summary card is removed. Clicking a pin moves that gym's row to the top, highlights it (green tint, lime border), shows a "Details" button, and scrolls the list to it. "Details" or the row opens the profile.
6. **No bottom tab bar** (it is for mobile).
7. **Map stays as it is now:** current light OpenStreetMap tiles, full width, current markers and route line. No dark tiles, no compass or locate-me buttons, no legend pill (the legend colours would not match the current markers). Everything below the map follows the reference.
8. **Dates and people stay where they are now:** on `/plan`, and shown as chips on `/map` (moved under the "Gyms around you / on your route" heading).
9. **Numbers:**
   - **"500+ Gyms mapped" becomes a real number:** the count of gyms in India in OpenStreetMap, fetched by a new public `api/stats` function (one Overpass count query, cached for a day). Shown rounded, for example "4,800+". If the lookup fails, the stat is hidden instead of showing a made-up number.
   - **"3km Near-you radius"** is already true.
   - **Ratings are mock-ups for now:** a stable fake rating per gym (the same gym always gets the same value, between 3.8 and 4.8), used in the map rows, the gym page and the landing stat "Avg. rating". It is kept in one place in the code (`src/lib/mock.ts`) so it is easy to remove when real ratings exist.
   - The landing phone's three example gym cards stay as illustration.

## Sun icon (decided)
- **Left out.** No sun icon, no light mode. The top bar is: Trace logo · Home / Routes / Features / About · Get Started (signed out) or Find gyms + avatar (signed in).
- The top bar is on the landing page, as in the reference. The map page keeps its own header (logo + avatar); `/plan` keeps its logo + avatar corner.

## Map page layout (after the decisions)
```
[ Trace                                                 (avatar) ]
[                     map (unchanged, full width)                ]
GYMS AROUND YOU  (Edit)                                  19 FOUND
Andheri West, Mumbai   · 1 person · 4 Oct → 5 Oct
(Parking x) (Shower x)                          [funnel]  CLOSEST
┌────────────────────────────────────────────────────────────────┐
│ [photo]  Gym name                                      1.2 KM  │
│          Area                         4.6★  Parking • Open     │
│                                     ₹— /mo  |  ₹— /day         │
└────────────────────────────────────────────────────────────────┘
┌ selected row: green tint + lime border ────────────────────────┐
│ [photo]  Gym name                                      0.6 KM  │
│          Area   (Details)             4.3★  Parking • Open     │
└────────────────────────────────────────────────────────────────┘
```
- Route search: heading "Gyms on your route", subtitle "Andheri → Bandra · 7.5 km · 8 min drive".
- "Open" shows only when the gym's opening hours are in OpenStreetMap and say it's open now (`opening_hours` npm package); otherwise nothing is shown.
- Area: `addr:suburb` / `addr:city` from OpenStreetMap, otherwise "Area not listed".
- "Parking" shows only when OpenStreetMap tags it.
- Sort: Closest (default) and A–Z.

## Files expected to change
`src/pages/Home.tsx`, `src/pages/MapView.tsx`, `src/pages/GymDetails.tsx` (mock rating), `src/lib/useStoredQuery.ts` (localStorage, filters), `src/App.tsx`, `src/index.css`, new `src/lib/mock.ts`, new `api/stats.ts`, `api/_lib/geo.ts` + `src/types.ts` (area name, open-now), `package.json` (`opening_hours`, Archivo Black font import).

## Status (round 3)
- [x] Answers to questions 1–8  - [x] Sun icon decision (left out)  - [x] Landing page  - [x] Map page  - [x] Persistence until sign-out  - [x] Verify
- Verified 2026-10-03: typecheck, lint, build pass. Browser (signed in): landing matches the reference layout (nav, Archivo Black headline, route line + dot, phone with overflowing cards, feature list, stats, About section); Routes → `/plan` prefilled from the saved search; About/Features scroll; nearby search Hinjewadi Phase 3 → 31 gyms in reference-style rows; pin click → row moved to top, green highlight, Details → profile (mock rating shown); Swimming Pool filter + A–Z sort; reload of `/map` kept the search and the filter. `/api/stats` returned 4,189 gyms in India.
- Changes found while testing:
  - Overpass (the gym data server) timed out on some searches. Searches now fall back to a mirror server, and the map page has a "Try again" button.
  - The India-wide count takes about 2 minutes and the main server rejects it, so it runs on the mirror first and is cached for a day (Vercel CDN cache + per-instance memory). Until it loads, the stat shows "—"; if it fails, the stat is hidden.
  - "Open now" is computed on the server against India time (the `opening_hours` library is 1.2 MB, too heavy for the browser).
  - `scrollIntoView` did nothing on the landing page (`.site` has `overflow: hidden`), so the nav scrolls the window directly.
  - Saved data is also cleared when the app loads with no one signed in (covers a session that expired while the browser was closed).
- Not tested: sign-out clearing saved data (needs a sign-out on your account); route-mode results header in the browser (same code path as nearby, typechecked); mobile widths.

---

# Round 4 — gym profile page (reference: `Cult Fit Hinjewadi Gym Dashboard.png`)

## Done (2026-10-03)
- `/gym/:id` rebuilt to match the reference: photo area, name + Open/Closed badge, rating + reviews + distance, address, Get Directions, feature tags, price card with Lock this deal / Show interest, Your must-haves meter, Features you starred, About, Deal options, Gym info.
- **Real data:** name, address (or area), distance, Open/Closed (only when OpenStreetMap has opening hours), features, opening hours, phone, website, directions link. "About" is written from that real data, since OpenStreetMap has no descriptions.
- **Mock data (all in `src/lib/mock.ts`):** rating, review count, monthly price, day-pass price. The same gym always gets the same values, and the map rows now show the same mock prices instead of "₹—". A note at the bottom of the page says these are sample values.
- **Photos:** placeholder ("No photos yet"); no fake 1/8 counter.
- **Works, saved until sign-out:** heart (save gym), Lock this deal / Show interest (with Undo; nothing is sent to the gym), chosen deal option, removing a starred feature (same filter as the map page).
- **Left out from the reference:** the search bar (there is no gym/trainer search), the bottom tab bar (mobile only, as decided), "See All" (only three deal options exist). "Compare" became "Compare on map".
- **Fixes found while testing:** a slow map-data request could hang forever, so requests now time out (15 s, 30 s for gym searches) and fall back to the mirror server; the profile now opens at the top instead of at the map page's scroll position.
- **Verified:** typecheck, lint, build; in the browser, opened a gym from the map, opened it again by direct link, saved it and locked a deal, reloaded and both were kept, then undid both.
- **Not tested:** mobile widths; a gym with phone/website/hours listed (the tested gym had none).

---

# Round 5 — Vercel ready (2026-10-03)
- `api/` imports now use `.js` extensions: the project is ESM (`"type": "module"`), and Vercel's Node runtime can't resolve extensionless relative imports. Verified by compiling `api/` to JS and loading every function with plain Node (all load; `/api/gyms` without a token returns 401).
- `vercel.json`: Vite framework, `dist` output, SPA rewrite for app routes (everything except `/api/*` and `/assets/*` → `index.html`), `maxDuration` 300 s for `api/stats.ts` and 120 s for `api/gyms.ts`.
- `.env.example` (Clerk keys), `.vercel` in `.gitignore`, `@types/node` dev dependency, `engines.node >= 20`, README with deploy steps.
- Local dev unchanged: `/api/*` answers and deep links load.
- Not done (needs the user): Vercel project/Git connection, env vars in Vercel, a real deploy. The rewrite can only be confirmed on Vercel itself (the Vercel CLI isn't installed here).


---

# Round 6 — admin panel, bookings, gym management, reviews (PLAN ONLY, nothing implemented)

App name is **FitPath** (renamed from "Trace" on 2026-10-14). This section is both the design and the build plan. Nothing below is built until it is approved.

## Goal
One admin (the owner) can sign in to an admin area and:
1. **Monitor** which user booked which gym, for which date, for how much.
2. **Manage** gym profiles (details, prices, images) and the reviews users gave.

## Decisions already made (from the user)
- **Reserve only for now.** A booking is saved with its date and price; the user pays at the gym. The admin sees the amount as "due". **Paying in the app comes later** (the schema leaves room for it, see "Later: online payment").
- **Database:** Neon Postgres. The user supplied a connection string for a new, unused database; use it only if it is confirmed empty (Phase 0). Otherwise create a fresh Neon project, asking first.
- **User identity on a booking:** the user's name and email from their Clerk account, copied onto the booking.
- **Admin login:** through Clerk. The admin signs up at `/auth` with their own email and a password they choose. No password is stored in code or in any file; the server treats only a **verified** email listed in `ADMIN_EMAILS` as admin.
- **Build order:** parts 1+2 first (foundation + bookings), then 3 (gym management), then 4 (reviews). Each part is shippable on its own.

## Assumptions to confirm (not yet agreed)
1. **One date per booking.** Day pass and free trial are that single day; a monthly plan starts on that date and runs 30 days.
2. **Booking states:** `booked` and `cancelled`. Users can cancel their own booking until its date; admin can change any status. (No "pending approval" step.)
3. **Gym prices become real.** Admin sets monthly and day-pass prices per gym (INR). A gym without prices shows the current sample prices, labelled as sample, and **cannot be booked** until it has a price. *Alternative:* allow booking at sample prices (simpler, but the money numbers are fake).
4. **Reviews:** only a user with a non-cancelled booking at that gym can review it; one review per user per gym; rating 1-5 plus optional text. Once real reviews exist the sample ratings are replaced by the real average and count; gyms with none show "No reviews yet".
5. **Admin edits gyms by overlay, not by owning them.** Gyms still come from OpenStreetMap; admin edits are saved on top (a gym can also be hidden). Admin cannot add a gym that is not on OpenStreetMap in this round.
6. **Images:** Vercel Blob storage (jpeg/png/webp, max 5 MB each, max 10 per gym).

## Architecture

```
Browser (React, Clerk session)
  |- user pages:  /gym/:id (Book, reviews)   /bookings (my bookings)
  '- admin pages: /admin  /admin/gyms  /admin/gyms/:id  /admin/reviews      (lazy-loaded)
        |  Bearer Clerk token
        v
Vercel functions (api/)
  existing: geocode  gyms  gym  stats  rates
  new:      bookings (user)   reviews (user)   admin (one function, ?resource=...)
        |                                   |
        v                                   v
  OpenStreetMap services            Neon Postgres  +  Vercel Blob (images)
```

- **Function count:** Vercel's free plan allows 12 functions. Three new ones (`bookings`, `reviews`, `admin`) bring the total to 8. The admin API is **one** function that switches on `?resource=` (`me`, `stats`, `bookings`, `gyms`, `reviews`, `upload`), so the dev plugin in `vite.config.ts` (single-segment `/api/<name>` only) keeps working unchanged.
- **DB access:** `@neondatabase/serverless` (works in Vercel functions and in `npm run dev`). A small `api/_lib/db.ts` exposes one `sql` helper; every query is parameterised.
- **Migrations:** plain numbered SQL files in `db/migrations/`, applied by `npm run db:migrate` (a tiny script that records applied files in a `schema_migrations` table). No ORM.
- **Admin check, server side on every admin request:** `requireAdmin` verifies the Clerk token, loads the user from Clerk, and requires a **verified** primary email in `ADMIN_EMAILS` (comma-separated env var). The `/admin` pages hide themselves for non-admins, but that is cosmetic; the API is the gate. Admin lookups are cached in memory for 60 s to avoid a Clerk call per request.
- **Price truth is server-side.** The booking amount is computed on the server from the gym's stored prices and the chosen plan; the client never sends an amount. The amount is copied onto the booking so later price edits do not rewrite history.

## Data model (Postgres)

| Table | Columns |
|---|---|
| `bookings` | `id uuid pk`, `clerk_user_id`, `user_name`, `user_email`, `gym_id` (e.g. `node-123`), `gym_name`, `plan` (`month`/`day`/`trial`), `start_date date`, `people int`, `amount_inr int`, `status` (`booked`/`cancelled`), `payment_status` (`due`; later `paid`/`refunded`), `created_at`, `updated_at` |
| `gym_overrides` | `gym_id pk`, `name`, `address`, `phone`, `website`, `hours`, `description`, `features text[]`, `month_price_inr int`, `day_price_inr int`, `hidden bool`, `updated_at`, `updated_by` |
| `gym_images` | `id uuid pk`, `gym_id`, `url`, `alt`, `position int`, `created_at` |
| `reviews` | `id uuid pk`, `gym_id`, `clerk_user_id`, `user_name`, `rating int (1-5)`, `body text`, `hidden bool`, `edited_by_admin bool`, `created_at`, `updated_at`; unique (`gym_id`, `clerk_user_id`) |
| `schema_migrations` | `name pk`, `applied_at` |

Indexes: `bookings(start_date)`, `bookings(gym_id)`, `bookings(clerk_user_id)`, `gym_images(gym_id, position)`, `reviews(gym_id)`. Null override columns mean "use the OpenStreetMap value".

## How overrides reach users
`/api/gyms` and `/api/gym` fetch from Overpass as today, then run **one** query for the overrides, images and review stats of the returned ids and merge them into each gym (`images`, `prices`, `rating`, `reviewCount`, edited fields; hidden gyms are dropped). Features filter, search and sorting keep working because they run on the merged gym. The client stops calling `mockPrices`/`mockRating`; pricing and ratings come from the API.

---

## Phase 0 - Before any code (needs the user)
- [ ] Confirm which database to use. If the pasted Neon link is used: check it is empty (read-only), keep it only in git-ignored `.env.local` and Vercel env settings, **never in code, plan files, or commits**. Rotate its password afterwards (it was shared in chat).
- [ ] Create the admin account: sign up at `/auth` with the admin email and a password the owner chooses (rotate the admin password that was shared in chat).
- [ ] Answer the six assumptions above.
- [ ] Later (Phase 3): create a Vercel Blob store and set `BLOB_READ_WRITE_TOKEN`.

New env vars (names only; `.env.example` gets placeholders): `DATABASE_URL`, `ADMIN_EMAILS`, `BLOB_READ_WRITE_TOKEN` (Phase 3).

## Phase 1 - Foundation and admin login
**Files:** `api/_lib/db.ts`, `api/_lib/admin.ts` (`requireAdmin`), `api/admin.ts`, `db/migrations/001_init.sql`, `scripts/migrate.mjs`, `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/AdminHome.tsx`, `src/components/AdminRoute.tsx`; edits to `src/App.tsx`, `src/lib/api.ts` (add POST/PATCH/DELETE helpers), `package.json`, `.env.example`, `src/index.css`.
- [ ] Add `@neondatabase/serverless`; `npm run db:migrate`; migration 001 creates `schema_migrations` and `bookings` (other tables arrive with their phase).
- [ ] `requireAdmin`; `GET /api/admin?resource=me` returns `{ admin: true }` or 403.
- [ ] Admin shell at `/admin` (lazy-loaded): header, nav (Bookings, Gyms, Reviews), sign-out; non-admins see a plain "You don't have access" page.
- **Verify:** typecheck/lint/build; signed-out user is redirected; signed-in non-admin gets 403 from the API and the access page; the admin email sees the shell. Test `requireAdmin` with a mocked Clerk (admin, non-admin, unverified email, missing env).

## Phase 2 - Bookings
**Files:** `api/bookings.ts`, admin resources `bookings` and `stats`, a booking step on `/gym/:id` (page or sheet), `src/pages/MyBookings.tsx`, `src/pages/admin/AdminBookings.tsx`; edits to `GymDetails.tsx`, `useStoredQuery.ts`, `App.tsx`.
- [ ] **User:** on `/gym/:id`, "Lock this deal / Show interest" become one **Book** flow: choose plan, date (not in the past), people, then a confirm screen showing the price in the chosen currency (stored in INR) and "Pay at the gym", then `POST /api/bookings`. The server validates plan, date, people (1-99) and that the gym has a price, and writes name/email from Clerk.
- [ ] `GET /api/bookings` (own, newest first); `PATCH /api/bookings` to cancel an own booking before its date. A `/bookings` page lists them, linked from the header menu.
- [ ] **Admin:** `/admin` dashboard cards (bookings today, upcoming, total amount due, cancelled) and a bookings table: user name/email, gym, plan, date, people, amount (INR, with a note if the viewer's currency differs), status, created. Filters: date range, gym, status, text search on user. Admin can change status. Pagination (50 per page).
- [ ] Remove the localStorage "deals" feature (`useDeal`, `trace:deals`) and its note text.
- **Verify:** unit tests for amount calculation, date/people validation and cancel rules; real flow with two test users: book, then see it in My bookings and in admin; user A cannot see or cancel user B's booking; an admin status change shows for the user; a tampered POST with an `amount` field is ignored.

## Phase 3 - Gym management
**Files:** `db/migrations/003_gyms.sql`, admin resources `gyms` and `upload`, `api/_lib/gyms-merge.ts`, `src/pages/admin/AdminGyms.tsx`, `AdminGymEdit.tsx`; edits to `api/gyms.ts`, `api/gym.ts`, `src/types.ts`, `GymDetails.tsx` (image gallery replaces the "No photos yet" box), `MapView.tsx` (real price and rating, photo thumbnail).
- [ ] Admin Gyms page: an area search (reuses `/api/gyms`) plus a list of gyms that already have edits. Each row opens the edit form.
- [ ] Edit form: name, address, phone, website (http/https only), hours, description, feature checkboxes (full list, so admin can add features OpenStreetMap lacks), monthly and day-pass price, hide/show gym. "Reset to map data" clears the overlay.
- [ ] Images: browser-direct upload to Vercel Blob through a server-issued token (avoids the 4.5 MB function body limit); admin-only token route; type and size limits enforced in the token; reorder and delete; alt text.
- [ ] Merge overrides into `/api/gyms` and `/api/gym` (one batched query). The filter's "supported features" list now includes admin-set features.
- **Verify:** unit tests for the merge (override wins, null falls back, hidden dropped); edit a gym, then see the change in search, on the map and on the profile; upload, reorder and delete an image; a non-admin cannot reach any admin gym or upload route; a gym with no price shows sample prices and the Book button is disabled with an explanation.

## Phase 4 - Reviews
**Files:** `db/migrations/004_reviews.sql`, `api/reviews.ts`, admin resource `reviews`, `src/components/Reviews.tsx` (on `/gym/:id`), `src/pages/admin/AdminReviews.tsx`; edits to `GymDetails.tsx`, `MapView.tsx`, `src/lib/mock.ts` (rating/review helpers removed).
- [ ] Users with a non-cancelled booking at the gym can post one review (1-5 stars, optional text up to 1,000 characters) and edit or delete their own. Every signed-in user sees the list.
- [ ] The gym rating and count on the map list and profile come from real reviews; "No reviews yet" otherwise. The sample-data note shrinks to cover only what is still mocked (the Home page's sample average rating is replaced by the real average or removed).
- [ ] Admin Reviews page: all reviews with gym, user, rating, text, date; edit text, hide/unhide, delete; filter by gym and rating.
- **Verify:** unit tests for rating aggregation and the "must have booked" rule; one review per user enforced by the database; admin edits and hides show up immediately for users; hidden reviews are excluded from averages.

## Cross-cutting
- **Security:** parameterised SQL only; the server validates every input (lengths, enums, URL schemes, ids matching `^(node|way|relation)-\d+$`); users can only read or change their own bookings and reviews; admin routes always call `requireAdmin`; image URLs are accepted only from our Blob host; no secrets in the repo (`.env.local` stays git-ignored, `.env.example` has placeholders); responses never include other users' emails except on admin routes.
- **Privacy:** bookings hold name and email; only the admin and the booking's owner can see them. Reviews show the reviewer's first name only to other users.
- **Testing:** the project has no tests today. Add **Vitest** (new dev dependency) for the pure logic named per phase; everything else is verified by running the real flow with test accounts. Browser checks need real Clerk logins, so the user (or test accounts the user creates) must sign in; I cannot enter passwords.
- **Bundle:** admin pages are lazy-loaded so normal users do not download them (the build already warns about chunk size).
- **Deploy:** add `DATABASE_URL`, `ADMIN_EMAILS`, `BLOB_READ_WRITE_TOKEN` in Vercel (Production and Preview); run migrations before each deploy; use a Clerk **production** instance before launch (dev keys are limited).
- **Docs and memory:** update `README.md` (env vars, admin setup, migrate command) and the project memory note after each phase.

## Later: online payment (option B, not in this round)
Add a provider (Razorpay is common in India; Stripe also works) with the owner's account keys: a checkout step after "Book", a webhook that sets `payment_status` to `paid` or `refunded`, and a paid column and totals in admin. The `amount_inr` and `payment_status` columns already exist for this.

## Out of scope for this round
Online payment, email/SMS notifications, refunds, gym-owner accounts, adding gyms that are not in OpenStreetMap, per-admin permissions (the `ADMIN_EMAILS` list can hold several people, all with full access), CSV export, analytics charts.

## Status (round 6)
- [x] Plan approved (2026-10-14)  - [x] Phase 0 (database empty, tables created)  - [x] Phase 1  - [x] Phase 2  - [x] Phase 3  - [x] Phase 4
- Built 2026-10-14. Verified: typecheck, lint, build; 33 unit tests (`npm test`); 13 tests of the real bookings/reviews/admin/image handlers against the Neon database (`npm run test:db`); every protected endpoint returns 401 without a token. NOT verified: the new screens in a browser while signed in (the Chrome extension was not connected and Clerk logins can't be entered by the assistant).

### What differs from the plan above (decided with the user or forced by the code)
- **Plans and dates (user's change):** six plans, day pass / 1 week / 1 month / 3 months / 6 months / 1 year (no free trial). No date picker: the booking starts the day it is made (India's calendar) and ends per plan (inclusive; months are calendar months). A user can cancel while the booking has not ended.
- **Price is per person;** the booking amount is price x people, computed on the server.
- **Images are stored in Postgres (`bytea`), not Vercel Blob,** so nothing outside Neon needs setting up. The browser shrinks each photo to at most 1600 px (JPEG) first; the server accepts JPEG/PNG/WebP up to 3 MB, 10 per gym. Served by the public `api/image` function with a long cache. Function count is now 9 of 12.
- **Prices are per plan per gym** (six optional fields); a plan is bookable only when it has a real price. The sample price table in `api/_lib/plans.ts` replaces `src/lib/mock.ts` (deleted), along with the sample ratings and the Home/sign-in "avg. rating" figures.
- **Admin can also set a booking's payment status** (due / paid / refunded) so money collected at the gym can be tracked.
- **Admin Gyms page** has an area search plus a list of already-edited gyms; hidden gyms only appear in that list.
- The review rule uses the user's active (`booked`) booking; cancelling a booking removes the right to post a new review, but an existing review stays.
- **Not done:** online payment, notifications, a Clerk production instance, deployment (needs `DATABASE_URL` and `ADMIN_EMAILS` in Vercel and a migration run against production), a browser pass of the signed-in screens, rotating the database and admin passwords that were shared in chat.


---

# Round 7 — gym owner (vendor) registration and approval (PLAN ONLY, nothing implemented)

Builds on Round 6 (admin panel, bookings, reviews, Neon database). Nothing below is built until it is approved.

## Goal
Gyms register themselves, so the admin does not add every gym by hand:
1. The admin creates a **registration link** and shares it with a gym.
2. The gym owner opens it, signs in, and creates the gym's profile: name, location, details, features, prices, photos and videos.
3. The admin sees the registration in a queue and **approves it before it goes live**.
4. The owner keeps their own login: they can edit the profile, photos and videos, and see their bookings and reviews, but **cannot edit reviews or ratings**.

## Decisions already made (from the user)
- **Owners have their own login** (the same Clerk sign-in as everyone else), not a one-time form.
- **Videos are uploaded as files** (not links), stored in **Vercel Blob**.
- **Every edit needs admin approval**, including text, prices, photos and videos. The public sees the approved version until the admin approves the change.
- **One pending draft per gym** (no full revision history).
- Owners can **see** bookings, reviews and ratings; they cannot edit reviews or ratings. Only the admin can.

## Defaults I chose (change if wrong)
1. **Link:** one gym per link, single use, expires after 14 days; the admin can cancel it before it is used.
2. **Location:** the owner types the address; the server looks up coordinates (India only, like search) and the owner confirms the pin on a small map.
3. **Prices:** the owner sets the six plan prices (INR, per person), same as the admin does for map gyms.
4. **Suspend:** the admin can take a live gym offline and bring it back.
5. **One gym per owner account** for now.
6. **Owners see, for each booking:** the person's name, plan, dates, people and amount. **No email**, so owners cannot contact customers outside the app.
7. **No email notifications** in this round: the admin sees new items in the queue and a count on the dashboard; the owner sees the status on their dashboard.
8. **Media limits:** photos JPEG/PNG/WebP, 5 MB each, up to 10; videos MP4/WebM/MOV, 50 MB each, up to 3. Opening hours stay free text.
9. **The admin does not edit a vendor gym's content directly;** content changes come from the owner through approval (the admin can suspend, or reject with a note).

## How it works

```
Admin creates invite  ──►  link  /register/<token>  ──►  owner signs in (Clerk)
                                                              │ claim (token is consumed)
                                                              ▼
                              vendor gym: status "new"  ──►  owner fills profile + uploads media
                                                              │ Submit for approval
                                                              ▼
              Admin queue  ◄── status "pending"            (first time)  or  "live" + pending draft (later edits)
                   │ Approve                         │ Reject (note)
                   ▼                                 ▼
        live profile replaced by the draft     owner sees the note, fixes, submits again
        gym appears in search and can be booked
```

- **Roles:** a normal user, an owner (a user linked to a vendor gym in the database), or an admin (email in `ADMIN_EMAILS`). Owner access is decided on the server by looking up the caller in `vendor_gyms`.
- **Drafts:** a gym has its live profile plus at most one draft. The owner edits the draft and submits it; editing a submitted draft withdraws the submission until it is submitted again.
- **Media follows the same rule:** new files are `pending_add`, removals are `pending_remove`. Approve makes adds `approved` and deletes removals. Reject deletes pending adds and restores pending removals.
- **Search integration:** live vendor gyms have ids like `vendor-<uuid>` and live in the database. `/api/gyms` adds the live vendor gyms within the radius (a bounding box plus a distance check in SQL) to the OpenStreetMap results and sorts by distance; `/api/gym` reads them by id. Booking, reviews, prices, currency and filters then work unchanged because they are keyed by gym id.

## Data model (migration `002_vendors.sql`)

| Table | Columns |
|---|---|
| `vendor_invites` | `id uuid pk`, `token_hash text unique` (SHA-256 of the token; the token itself is never stored), `label text`, `created_by`, `created_at`, `expires_at`, `used_at`, `used_by_clerk_id`, `revoked_at` |
| `vendor_gyms` | `id text pk` (`vendor-<uuid>`), `owner_clerk_id text unique`, `owner_name`, `owner_email`, `invite_id`, `status` (`new` / `pending` / `live` / `suspended`), `live jsonb`, `live_lat double precision`, `live_lon double precision`, `draft jsonb`, `draft_submitted_at`, `review_note`, `approved_at`, `created_at`, `updated_at` |
| `vendor_media` | `id uuid pk`, `gym_id`, `kind` (`photo` / `video`), `url`, `content_type`, `size_bytes`, `alt`, `position`, `status` (`approved` / `pending_add` / `pending_remove`), `created_at` |

`live` and `draft` hold: name, address, lat, lon, phone, website, hours, description, features, prices (per plan). Indexes: `vendor_gyms(status, live_lat, live_lon)`, `vendor_media(gym_id, status)`, `vendor_invites(expires_at)`.

## API and functions
- New function `api/vendor.ts`, switching on `?resource=`: `claim`, `me`, `draft` (save), `submit`, `media` (register an uploaded file, mark one for removal), `upload` (issues Vercel Blob upload tokens), `bookings` (read-only), `reviews` (read-only).
- Admin additions inside the existing `api/admin.ts`: `invites` (create, list, cancel) and `registrations` (queue, detail with live and draft side by side, approve, reject, suspend, reinstate). The dashboard stats get a pending count.
- Changes to existing code: `validate.ts` accepts `vendor-<uuid>` gym ids; a single "load any gym by id" helper (map or vendor) replaces `getGymById` in `bookings`, `gym`, and the admin gym detail; `gym-data.ts` gains vendor media (photos and videos) in the merged gym; `GymImage` becomes a media item with a `kind` and a `url`.
- Function count goes from 9 to 10 of Vercel's 12.
- New dependency: `@vercel/blob`.

## Phase 0 — Before any code (needs the user)
- [ ] Approve this plan and the defaults above.
- [ ] Create a Vercel Blob store for the project and add its token as `BLOB_READ_WRITE_TOKEN` in `.env.local` and in Vercel yourself (do not paste it into chat). Local uploads need it too.
- [ ] Rotate the Neon and admin passwords that were shared in chat (still open from Round 6).

## Phase 1 — Foundation
**Files:** `db/migrations/002_vendors.sql`, `api/_lib/vendor-model.ts` (types, status rules), `api/_lib/gym-lookup.ts` (map or vendor gym by id), `api/_lib/vendor-auth.ts` (`requireVendor`: the caller's own gym or 403), edits to `validate.ts`, `bookings.ts`, `gym.ts`, `reviews.ts`.
- [ ] Migration, then the vendor gym id format and lookup helper, then `requireVendor`.
- **Verify:** typecheck/lint/test; unit tests for the id format, status transitions and the owner check (owner A cannot reach gym B).

## Phase 2 — Invites and claiming
**Files:** `api/_lib/invites.ts` (create token, hash, validate expiry/use/revoke), admin `invites` resource, `src/pages/admin/AdminVendors.tsx` (invites list and create), `src/pages/RegisterGym.tsx` at `/register/:token`, `api/vendor.ts` (`claim`).
- [ ] Admin creates an invite with a label and gets the link once (copy button); the list shows pending, used, expired and cancelled links.
- [ ] `/register/:token` explains what will happen, asks the owner to sign in or sign up, then claims. An invalid, used, expired or cancelled link shows a clear message. A user who already owns a gym is told so.
- **Verify:** unit tests for token hashing, expiry, single use and revocation; database test: create, claim once, second claim refused, expired and cancelled refused, the token never appears in the database.

## Phase 3 — Owner dashboard
**Files:** `src/pages/vendor/VendorLayout.tsx`, `VendorProfile.tsx`, `VendorMedia.tsx`, `VendorBookings.tsx`, `VendorReviews.tsx`, `api/vendor.ts` (`me`, `draft`, `submit`, `media`, `upload`, `bookings`, `reviews`), `api/_lib/vendor-draft.ts` (validate draft, merge, apply), a link to `/vendor` for owners in the app header.
- [ ] Profile form (name, address with geocode and map confirmation, phone, website, hours, description, features, six prices) saves to the draft; "Submit for approval" sets `draft_submitted_at`.
- [ ] Media: direct upload to Blob through a token the server issues only to this owner for the allowed types and sizes; the client then registers the file. Previews, alt text, delete (marks a removal when the file is already live), reorder.
- [ ] Status banner: not submitted, waiting for approval, live, changes requested (with the admin's note), suspended. The owner sees the live version and, separately, the pending changes.
- [ ] Bookings and Reviews tabs are read-only (name, plan, dates, people, amount; reviews list, average and count). No email is returned by the vendor API.
- **Verify:** unit tests for draft validation and the apply/reject rules; database test: save draft, submit, edit withdraws submission; another owner and a normal user are refused on every vendor resource; the bookings response contains no email.

## Phase 4 — Admin review queue
**Files:** admin `registrations` resource, `src/pages/admin/AdminRegistrations.tsx` (queue and detail), a nav item and a count on `AdminLayout`/`AdminBookings`.
- [ ] Queue of new gyms and pending changes with a side-by-side view (live vs draft, media thumbnails and video players, changed fields marked).
- [ ] Approve: draft becomes live, media applied, `live_lat`/`live_lon` updated, gym status `live`. Reject: requires a note, nothing public changes. Suspend and reinstate for live gyms.
- **Verify:** database test: approve a first submission (gym becomes live), edit then approve (live replaced), edit then reject (live unchanged, note stored, pending media removed), suspend (gone from search), reinstate.

## Phase 5 — Public side
**Files:** edits to `api/gyms.ts`, `api/_lib/gym-data.ts` (vendor gyms near a point, media for vendor gyms), `src/types.ts`, `GymDetails.tsx` (gallery shows photos and plays videos), `MapView.tsx` (thumbnail from the first photo).
- [ ] Live vendor gyms appear in search by distance with the same filters, prices and ratings; a gym with prices is bookable; reviews and bookings work as for any gym.
- [ ] Gym page gallery shows videos with controls (no autoplay).
- **Verify:** database test: a live vendor gym is returned near its coordinates and not far away, a suspended or unapproved one is not; booking and reviewing a vendor gym works; the owner's bookings view shows it.

## Phase 6 — Wrap-up
- [ ] README (Blob token, invite flow), `.env.example` (`BLOB_READ_WRITE_TOKEN` placeholder), project memory, and this section's status.
- [ ] A full typecheck, lint, unit and database test run; a browser pass of the signed-in flows by the user (owner, admin and a normal user).

## Cross-cutting
- **Security:** tokens are random (32 bytes), stored only as a hash, single use, expiring; every vendor call checks the gym belongs to the caller; uploads are authorised per owner with fixed types and sizes and the registered URL must be on our Blob host; the vendor API never returns customer emails; admin routes keep using `requireAdmin`; all SQL is parameterised; no secrets in the repo.
- **Privacy:** owners see customer first and last name only for their own gym's bookings. Reviewer names stay first-name-only for everyone but the admin.
- **Cost and limits:** Vercel Blob free tier storage and bandwidth apply to videos; the limits above keep that bounded.

## Out of scope for this round
Email or SMS notifications, owner replies to reviews, several gyms per owner, several staff accounts per gym, payouts or commission, direct admin editing of vendor content, revision history and rollback, video transcoding or thumbnails, online payment (still "later").

## Status (round 7)
- [x] Plan approved (2026-10-14)  - [ ] Phase 0 (Blob store and token still needed from the user; password rotation still open)  - [x] Phase 1  - [x] Phase 2  - [x] Phase 3  - [x] Phase 4  - [x] Phase 5  - [x] Phase 6 (docs)
- Built 2026-10-14. Verified: typecheck, lint, build; 50 unit tests (`npm test`); 35 database tests (`npm run test:db`, 22 of them the owner flow: invite, claim, draft, media, submit, reject, approve, public search, bookings and reviews on a registered gym, edits needing approval, suspend, owner isolation), all against the Neon database with sign-in and the Blob store mocked; the tests left every table empty. Live checks: protected endpoints return 401, the public link check works, `/register/<bad token>` shows "This link isn't valid", `/vendor` signed out goes to sign-in. NOT verified: the owner and admin screens while signed in, and a real upload to Vercel Blob (no token yet; the upload route answers "uploads are not set up yet").

### What differs from the plan above
- **Reject keeps the owner's draft and uploads** (the plan said it would delete pending files). The owner sees the admin's note, fixes what it says and submits again, without re-uploading everything.
- **No reordering of media** for owners. New files go after existing ones, the first photo is the main one; to change the order, remove and re-add. (Admin photo reordering for map gyms is unchanged.)
- **The upload permission check** reads the owner's sign-in token from the upload request payload (the Blob library cannot add headers), and the server then verifies each registered file with Blob (`head`) for size and type.
- **Submit rules:** name, an address with a confirmed map location, and at least one photo are required; prices are optional (a plan without a price cannot be booked).
- **Files added:** `db/migrations/002_vendors.sql`; `api/vendor.ts`; `api/_lib/{invites,vendor-model,vendor-store,gym-lookup,blob}.ts`, `admin/vendors.ts`; `src/pages/vendor/*`, `src/pages/RegisterGym.tsx`, `src/pages/admin/{AdminInvites,AdminRegistrations,AdminRegistrationDetail}.tsx`. Function count is 10 of 12.
- **Admin cannot edit a registered gym as a map gym** (the existing admin gym tools refuse `vendor-` ids). The admin approves, rejects, suspends or reinstates.
