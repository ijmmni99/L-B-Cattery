# L&B Cattery 3D

A first-person 3D cattery shop tycoon for mobile browsers (installable PWA). Vite + TypeScript + Three.js.

**Controls (first-person, FOV 72):** left thumb = move (floating joystick), drag on the right = look,
big button or a tap on the crosshair = interact. Settings (gear): graphics, look sensitivity, head bob, vibration.
Desktop: click to lock the mouse, WASD to move, click / E / Space to interact, Esc to release.

## Run

```bash
npm install
npm run dev        # dev server on your LAN (open the Network URL on your phone)
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build (PWA/offline works here)
```

Add `?debug=1` to the URL for the FPS / draw-call counter.

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
- [ ] M4 Products and shelves
- [ ] M5 Customers and checkout
- [ ] M6 Villas
- [ ] M7 Economy and progression
- [ ] M8 Care, staff and dirt
- [ ] M9 Polish and PWA
- [ ] M10 Asset swap pipeline
