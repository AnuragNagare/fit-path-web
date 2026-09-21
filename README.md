# Trace Your Route

Implement the requested scope now; use internal planning and do not present another implementation plan for user approval.

Build the 'Trace' gym-discovery web app matching the attached design screens with exact attention to typography, colors, dark styling, and layouts:

1. Visual Identity & Theme:
- Deep dark theme (pitch black / near black background) with vibrant neon/lime green accents (#C6F234 / #B8F827) and crisp white typography.
- Branding: "Trace" logo, sleek pill CTA buttons with arrows, subtle dark cards with fine borders, and dashed neon route lines with waypoint dots.

2. Screen 1: Landing Page (screen 1.png)
- Header: "Trace" logo, navigation links (Home, Routes, Features, About), lime pill button "Get Started >", and theme toggle.
- Hero section:
  - Subhead: "ROUTE-BASED DISCOVERY"
  - Headline: "FIND GYMS WHEREVER YOU GO." with "WHEREVER YOU GO." highlighted in lime green.
  - Description: "Complete details, honest photos, gyms that fit the route you already travel, not just the one nearest your pin."
  - CTA button: "FIND GYMS ON MY ROUTE >"
- Hero visual: Mockup previewing a dark route map with overlaid gym cards:
  - "IronFit Fitness" (4.6★, 2.1 km • On your route)
  - "Prime Performance" (4.4★, 3.2 km • On your route)
  - "FitZone Gym" (4.2★, 4.8 km • On your route)
- Feature list on the right:
  - Route-based recommendations (map pin icon)
  - Real photos & full details (camera icon)
  - Honest reviews & ratings (star icon)
  - Find the best gyms on your journey (dumbbell icon)
- Bottom metrics bar: "500+ Gyms mapped", "3km Near-you radius", "4.6★ Avg. rating".

3. Screen 2: Authentication (Screen 2.png)
- Split screen view / modal:
  - Left side: Moody gym interior with neon green line lighting ("BETTER STRONGER YOU"), "Trace" logo, "ROUTE-BASED DISCOVERY", "FIND GYMS WHEREVER YOU GO.", and supporting copy.
  - Right side: "Welcome Back" with "Back" highlighted in lime green, copy "Log in to your account and continue your fitness journey."
  - Form fields: "Email or Phone Number" with mail icon, "Password" with lock icon and reveal eye toggle, "Forgot password?" link.
  - Primary button: Lime green pill "Log In >".
  - Divider: "OR"
  - Social button: "Continue with Google".
  - Switcher: "Don't have an account? Create one >".

4. Screen 3: Route Discovery / Onboarding (Screen 3.png)
- Top bar with "Trace" logo, numbered step indicator (step 1 highlighted in lime circle, 2, 3), and profile avatar.
- Layout:
  - Left side: "CHOOSE YOUR ROUTE", headline "HOW DO YOU WANT TO FIND YOUR GYM?", description "Choose an option below to get started. We'll show you the best gyms based on your preference.", and the dark gym preview image.
  - Selection cards:
    - "Near me" card: highlighted with neon green border, pin icon, "Find gyms around your current location", radar pulse graphic, and active lime "Select ->" button.
    - "From a to b" card: route icon, "Plan a route and find gyms along the way", dashed path graphic with pins, and dark "Select ->" button.
- Connect all three views interactively so users can move smoothly between the landing page, login modal/page, and the route-selection flow.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6f86ec90-1127-4088-ad4a-8d0351754927).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
