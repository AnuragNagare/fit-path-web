# Implementation Plan: Booking.com Style Redesign for FitPath Gym Listing & Map

## 1. Overview & Objectives

Transform FitPath’s gym discovery page (`src/pages/MapView.tsx`) from its current vertical split (top map / bottom list) into a world-class, high-converting **Booking.com-style** search results layout, while strictly preserving FitPath’s brand color palette (`#FF5A0F`, `#12161F`, `#FFF3EA`, `#5B6475`).

---

## 2. Target Design & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│ Global Navigation (Brand, Admin/Vendor links, Currency, UserButton)    │
├────────────────────────────────────────────────────────────────────────┤
│ Top Search Ribbon (Location pill | People count | Edit search)         │
├────────────────────────┬───────────────────────────────────────────────┤
│ LEFT SIDEBAR (290px)   │ MAIN RESULTS FEED (Flexible)                  │
│                        │                                               │
│ ┌────────────────────┐ │ [Header] "New Delhi: 28 gyms found"          │
│ │ 🗺️ Show on map     │ │ [Chips] Filter chips   [Sort by: Distance ▼]  │
│ └────────────────────┘ │                                               │
│                        │ ┌───────────────────────────────────────────┐ │
│ • Budget Price Slider  │ │ [Photo + Fav] [Gym Name ★★★★] [Score 9.1] │ │
│   ₹400 – ₹5,000+       │ │               [Area • 1.2 km] [₹1,499/mo] │ │
│                        │ │               [✔ Parking ✔ AC] [View Pass›]│
│ • Popular Filters (qty)│ └───────────────────────────────────────────┘ │
│   ☑ Open Now (18)      │ ┌───────────────────────────────────────────┐ │
│   ☑ Parking (24)       │ │ [Photo + Fav] [Gym Name ★★★]  [Score 8.7] │ │
│   ☑ Showers (19)       │ │               [Area • 2.4 km] [₹1,999/mo] │ │
│   ☑ Cardio Deck (32)   │ │               [✔ Lockers]     [View Pass›]│
│                        │ └───────────────────────────────────────────┘ │
│ • Rating Filters       │                                               │
│   ☑ 9+ Exceptional     │                                               │
│   ☑ 8+ Very Good       │                                               │
└────────────────────────┴───────────────────────────────────────────────┘
```

---

## 3. Detailed Component Breakdown

### A. Sub-Components to Create / Refactor
1. **`src/components/booking/SearchRibbon.tsx`**:
   - Compact horizontal search pill ribbon at the top of the page.
   - Shows location name, distance radius (`Within 10 km`), member count (`1 person`), and an edit button (`Edit` pencil icon) to modify criteria.
2. **`src/components/booking/SidebarFilters.tsx`**:
   - **Mini-Map Widget:** Interactive thumbnail with custom SVG map illustration, pin icon, and a prominent button: **"Show on map"**.
   - **Price Range Filter:** Min & Max price inputs and dual range slider for monthly pass budgets.
   - **Faceted Popular Filters:** Checkboxes with real-time matching gym counts computed from current results (e.g. `Open Now (14)`, `Parking (22)`, `Showers (18)`, `Cardio Deck (35)`, `Locker Rooms (28)`).
   - **Review Score Filters:** Checkbox options for `9+ Exceptional`, `8+ Very Good`, `7+ Good`.
   - **Clear All Filters** trigger.
3. **`src/components/booking/GymCard.tsx`**:
   - 3-zone responsive horizontal card:
     - **Left Column:** 220px image container with zoom effect, top-right heart favorite toggle, top-left status tags (`Open Now` or `Closed`, `Verified Gym`).
     - **Center Column:** Bold title, star rating, area name, clickable **"Show on map"** link with map pin icon (which triggers the map modal and centers on this gym), and green checkmark amenity badges (`✔ Air Conditioned`, `✔ Free Parking`, `✔ Showers`, `✔ Cardio Deck`).
     - **Right Column:**
       - Review score badge (FitPath warm orange score badge e.g. `9.2`, with descriptor *"Exceptional"* and review count).
       - Pricing block (Monthly pass bold price e.g. `₹1,499 /month`, strikethrough original estimate, and secondary day pass rate `or ₹199 /day`).
       - High-visibility primary button: **"View Passes & Details ›"**.
4. **`src/components/booking/MapModal.tsx`**:
   - Fullscreen interactive Leaflet map modal overlay.
   - Smooth entrance animation with backdrop blur and header bar with search info and close (`✕`) button.
   - All visible gyms plotted as custom FitPath orange markers.
   - Clicking any pin activates a floating Booking.com-style preview card at the bottom of the map with photo, gym name, price, rating, and a direct "View Gym" button.
   - Auto-pans to the selected gym when opened from that gym card's "Show on map" link.

---

## 4. State Management & Data Flow

1. **Filtering Logic**:
   - Feature filter set: Gyms must include all selected features.
   - Price range filter: `gym.prices.month >= minPrice && gym.prices.month <= maxPrice`.
   - Rating filter: `gym.rating >= minRating` (if selected).
   - Dynamic Count Calculation: Calculate the count of matching gyms for each feature dynamically so users see exact numbers next to checkboxes.
2. **Sorting Logic**:
   - Closest Distance (default)
   - Price: Low to High
   - Price: High to Low
   - Rating: High to Low
   - Alphabetical (A to Z)
3. **Favorites Storage**:
   - Light-weight `localStorage` bookmark list so clicking the heart icon on any card persists across sessions.

---

## 5. Step-by-Step Execution Plan

- [ ] **Phase 1: Component Scaffold & Types**
  - Create `src/components/booking/SearchRibbon.tsx`
  - Create `src/components/booking/SidebarFilters.tsx`
  - Create `src/components/booking/GymCard.tsx`
  - Create `src/components/booking/MapModal.tsx`
- [ ] **Phase 2: CSS Styles & Design System**
  - Add modular, clean CSS in `src/index.css` under `/* BOOKING.COM STYLE GYM LISTING */`
  - Style 2-column responsive layout, 3-zone gym card, mini-map widget, review score badge, and modal map with floating preview card.
  - Ensure full responsiveness on tablets and mobile devices.
- [ ] **Phase 3: Integration in MapView.tsx**
  - Update `src/pages/MapView.tsx` to use the new layout, sidebar filters, cards feed, and modal map.
- [ ] **Phase 4: Verification & Validation**
  - Run build checks (`npm run build`) to ensure type safety and error-free compilation.
  - Verify layout responsiveness, filter interactions, sorting, and map modal synchronization.


---

# Round 8 — worldwide search only (2026-10-28)

Searching for a place now works anywhere in the world (for example Washington, DC), and the gyms shown are the ones around that place. Nothing else changed.

- `api/_lib/geo.ts`: the address lookup no longer limits results to India. "Open now" in the results is read on each gym's own clock (time zone from its coordinates, `api/_lib/zones.ts`, `tz-lookup`), because opening hours are written in local time and India's clock would show wrong "Closed" labels abroad.
- `api/geocode.ts`: the "not found" message no longer says India.
- Everything else is as before: prices in rupees, bookings and their dates on India's calendar, gym owner locations limited to India, the "gyms in India" count on the landing page, the currency picker.
- A bigger worldwide version (prices and bookings in each gym's own currency, each gym's own calendar, owners anywhere) was built and then removed again at your request; it is not in the code.
