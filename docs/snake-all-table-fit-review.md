# Snake and Ladder: all table seating fit

The old table height was measured from zero while the production chairs were grounded at a negative floor height. This left the playing surface roughly 1.16 scene units too high. Imported models were also fitted using their longest overall dimension, so narrow tops and flared feet could produce an unsuitable playing area.

This change uses the grounded seat height for the tabletop, preserves the original human pose and scale, and fits each imported playing surface to the chair ring. Deep aprons, cabinets and shelves have individual clearance profiles. Geometry is divided at the profile bends so long faces form a proper overhang; UVs and source materials remain attached. The octagon has a narrow pedestal, and the portrait camera can look over the nearer player.

## Verification

- All 14 selectable tables rendered in WebGL 2 with the production arena, four original seated humans, the loaded Sheen Chair, board, dice and three original firearm models.
- Inspected phone portrait, side and overhead views; repeated the side review after clearance repairs. Final viewport: 390 × 844.
- Checked every vertex of the original lower-body meshes and loaded chair meshes against every fitted imported table using vertical triangle intersections. No penetrations detected on the final 13 imported models (0.001 scene-unit intersection tolerance).
- 96 Snake regression tests passed after rebasing onto the latest main, including dice grip/release, weapon handling, parking, game turns, camera behavior and three new table-fitting tests.
- Production Vite build passed. The new fitting utility and inline preview passed a targeted strict TypeScript check. The wider existing interaction dependency graph still has pre-existing strict-null/indexing errors.
- Poly Haven's 1k and 2k manifest entries reference identical mesh binaries for all 13 imports. The review uses 1k textures. Octagon review materials are plain to avoid expensive procedural texture generation; gameplay retains its existing texture path.

WebGL ran in Chromium 153 using ANGLE/SwiftShader. This verifies actual browser rendering, but is not a physical-phone or Telegram-device test. The in-chat inspection uses reduced mesh detail and simplified materials exported from the checked scene.

## Repeat the review

From the repository root:

```sh
python scripts/snake-review/fetch-tables.py
node scripts/check-snake-tables.mjs
npm run test:snake --prefix webapp
```

For a manual live review, run the webapp's Vite dev server and open `/snake-table-review.html`. The Table picker covers the octagon and all 13 imported options; View provides phone portrait, leg clearance and overhead views.

For automated WebGL screenshots, install Playwright Core in your review environment, supply its module path and a Chromium executable, then run:

```sh
SNAKE_PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
SNAKE_CHROMIUM_PATH=/path/to/chromium \
node scripts/review-snake-tables.mjs
node scripts/build-snake-tables-preview.mjs
```

Screenshots and source snapshots are generated into ignored review directories. Models and textures are downloaded only for review and are not committed. Production continues to load the original catalog assets.
