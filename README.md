# L&B Cattery 3D

A first-person 3D cattery shop tycoon for mobile browsers (installable PWA). Vite + TypeScript + Three.js.

**Controls (first-person, FOV 72):** left thumb = move (floating joystick), drag on the right = look,
big button or a tap on the crosshair = interact. Settings (gear): graphics, look sensitivity, head bob, vibration.
Stocking: pick up a box (it unboxes itself), aim at a shelf slot, **tap** to auto-fill one by one or **hold** to fill only while held.
Customers: shoppers walk in, pick stocked items, queue at the counter; aim at the register and tap **Checkout** when one is ready (45 s patience).
Villas: aim at an empty villa → **Choose a cat** to adopt one from the shelter; locked villas can be unlocked with money. Tap a cat to play.
Economy: sales and adoptions earn XP and levels (unlock products and rarer cats). Set prices in Tablet → Prices; buy more shelves in Tablet → Upgrades. Progress autosaves in the browser (Settings → Reset progress to erase).
Desktop: click to lock the mouse, WASD to move, click / E / Space to interact, Esc to release.

## Run

```bash
npm install
npm run dev        # dev server on your LAN (open the Network URL on your phone)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build (PWA/offline works here)
```

Add `?debug=1` to the URL for the FPS / draw-call counter, `?cats=1` for the cat animation test panel.

## Deploy

Pushing to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`
(enable it once: repo Settings → Pages → Source: **GitHub Actions**).

## Structure

```
src/
  core/    renderer, loop, quality, fps, pwa
  game/    state, economy, day cycle, customers, staff, checkout, care, adoption
  world/   store layout, shelves, counters, villa slots, expansions
  models/  ModelFactory, CatBuilder, products, characters, villas, props
  ui/      HUD, tablet, menus, joystick, floating text
  config/  balance, products, cats, villas, upgrades
  assets/  future .glb files
```

## Milestones

- [x] M0 Setup
- [x] M1 Store shell and look
- [x] M2 Player and controls (first-person)
- [x] M3 Cats (CatBuilder)
- [x] M4 Products and shelves
- [x] M5 Customers and checkout
- [x] M6 Villas
- [x] M7 Economy and progression
- [ ] M8 Care, staff and dirt
- [ ] M9 Polish and PWA
- [ ] M10 Asset swap pipeline
