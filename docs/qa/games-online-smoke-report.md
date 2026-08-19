# Games Online Smoke Test Report

Date: 2026-02-25
Environment: `webapp` via Vite (`http://127.0.0.1:4173`) in mobile portrait viewport (390x844).

## Scope covered
Tested all games listed on `/games` by opening each lobby route from the Games catalog:

1. `/games/texasholdem/lobby`
2. `/games/domino-royal/lobby`
3. `/games/poolroyale/lobby`
4. `/games/snookerroyale/lobby`
5. `/games/goalrush/lobby`
6. `/games/airhockey/lobby`
7. `/games/snake/lobby`
8. `/games/murlanroyale/lobby`
9. `/games/chessbattleroyal/lobby`
10. `/games/tabletennisroyal/lobby`
11. `/games/ludobattleroyal/lobby`

Also spot-checked direct game routes:
- `/games/chessbattleroyal`
- `/games/tabletennisroyal`
- `/games/ludobattleroyal`

## Key findings

### 1) Missing lobby art assets (404)
Repeated 404s observed for:
- `/assets/game-art/lobby/pool-royale/mode-ai.webp`
- `/assets/game-art/lobby/pool-royale/mode-online.webp`

Impact:
- Broken/missing images in lobby experiences.
- Noisy console errors that can hide real regressions.

Priority: **High** (visual quality + noisy diagnostics).

---

### 2) Backend API endpoints unavailable in frontend-only run (404)
Repeated 404s observed for:
- `/api/online/ping`
- `/api/account/create`

Impact:
- Online availability/account bootstrap flows appear degraded in local frontend-only environment.
- Some game entry flows may not complete without backend process.

Priority: **Medium** (environment/dependency issue for full e2e).

---

### 3) External 3D asset URLs failing (403/404)
Multiple external GLB URLs from `raw.githubusercontent.com` / `cdn.jsdelivr.net` failed with 403/404.

Impact:
- Potential missing 3D pieces/board models in affected games.
- Slower startup/retries and poor first impression.

Priority: **High** if these are production dependencies.

---

### 4) TON Connect wallets list fetch errors
Observed console error:
- `[TON_CONNECT_SDK] TypeError: Failed to fetch`

Impact:
- Wallet-connect UX may be partially broken or degraded depending on network/provider availability.

Priority: **Medium**.

## Stability notes
- All 11 lobby routes from Games page were reachable and rendered.
- Browser container intermittently crashed (Chromium SIGSEGV) while attempting larger direct-route batch runs, so direct gameplay checks were partial in this session.

## Recommended next actions
1. Fix or replace missing lobby image references.
2. Run full stack (`webapp` + backend) for true online matchmaking/account flow validation.
3. Vendor/cache critical external GLB assets or provide robust in-repo fallbacks.
4. Add lightweight smoke checks in CI for:
   - all `/games/*/lobby` routes,
   - 4xx/5xx network error budget,
   - critical console error budget.
