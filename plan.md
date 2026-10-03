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
