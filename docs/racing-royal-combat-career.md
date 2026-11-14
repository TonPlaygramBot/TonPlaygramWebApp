# Racing Royal: main roads, combat and action career

This change builds on `main` at `db87525aecb41b7157ececc5e8e777ac028df3a8`.

## Playing

- **Garage → Combat Race** starts a local six-kart race with forward fire,
  warning lanes before enemy attacks, shields, finite ammunition and reloads,
  ammo/repair/shield pickups, and knockout explosions. Complete the race while
  keeping your kart running. The combat session does not award championship
  credits, race-task progress, or TPG.
- **Career → Action Missions** offers Depot Recovery, River Relay and Emergency
  Retrieval. Drive to the rendezvous, stop and exit, defeat the guards, interact
  with the objective, return to the parked kart, and drive to extraction.
  Missions unlock sequentially and award first-completion action XP only once.
  Replays can improve medals and times. Existing city jobs and cups remain.
- On foot, the left stick moves/strafe; the right stick turns the view. Run,
  jump, fire, reload and interaction buttons support simultaneous touches.
  Positive horizontal input follows the visible right side of the portrait
  view. The camera button switches between the eye view and chase view.
- Keyboard: driving uses WASD/arrows, Shift boost and Space drift. Combat adds
  F fire, Q shield and R reload. On foot use WASD to move, arrows to turn, Shift
  run, Space jump, F fire, R reload and E interact/enter/exit.

Mission characters reuse the original Turi GLB and its textures, humanoid rig,
weapon models and animation helpers. Health, ammunition, stamina, reloads,
enemy warnings, projectiles and deadlines advance with the fixed simulation
step. Pause, hidden tabs, mode switches and teardown clear held actions. Short
jump/interaction/reload taps are latched until the next simulation step.

## Roads and proportions

The six city circuits retain their saved IDs and follow connected mapped road
edges with source carriageways at least 6.2 m wide. The resulting race ribbons
are at least 5.05 m wide and stay on the original asphalt; no new shortcuts or
widened city streets are introduced. Rural circuits and free-roam remain.

| Circuit ID | Length |
| --- | ---: |
| `skanderbeg` | 2.486 km |
| `blloku` | 2.177 km |
| `lana` | 2.619 km |
| `pyramid` | 2.020 km |
| `stadium` | 2.814 km |
| `lana-pyramid-grand` | 3.333 km |

The kart GLBs were already fitted to 2.0 m long. Their collision width now
matches the visible outer tyres (1.48 or 1.56 m by family), replacing the
undersized 1.27 m footprint. Full and distant drivers retain adult proportions
independently of the kart asset's fit scale. Turi's normalized stature is 1.76 m;
the cockpit camera uses his actual head position.

The route generator is `scripts/build-racing-main-roads.mjs`. Geometry remains
shared between the browser and racing server. Combat itself is explicitly local;
the ordinary multiplayer protocol keeps its legacy weapon inputs inert.

## Verification and limits

Tests cover real GLB dimensions, driver hand/foot contacts, source-road and
building clearance, AI lap completion, projectile sweeps and misses, supply
cooldowns, finite ammo/shields, mission stages, collision-aware on-foot movement,
save/reward isolation, pause and lifecycle cleanup. Renderer/UI tests use the
real simulation with WebGL drawing mocked.

`test/racingCombatCareer.browser.mjs` is a portrait 390×844 smoke harness for the
production React/Three.js modules and original assets. It can be run on a machine
with Playwright Chromium available. Browser launch was blocked by this task
environment's Unix-socket restriction, so no rendered-browser, physical-phone
FPS or visual-quality claim is made. The harness is not a full mission playthrough.

Combat projectiles stop at the track ribbon so they cannot cut across city
blocks. Action missions use the existing static collision world for buildings,
barriers, water, line of sight and chase-camera clearance. Rivals are bounded
mission encounters; this is not a general pedestrian/open-world simulation.
No new downloads or dependencies are introduced. Deployment's external asset
download lifecycle is separate from the production bundle checks.

Useful commands from the repository root:

```sh
node --test test/racing*.test.mjs
node --test test/kartRoyale.test.mjs test/kartTpgMatchmaking.test.mjs test/kartStake.test.mjs
cd webapp
node_modules/.bin/tsc -p tsconfig.kart.json --pretty false
node_modules/.bin/vitest run --config vitest.navigation.config.mjs src/games/kartroyale
node_modules/.bin/vite build --config vite.kart.config.ts
node --max-old-space-size=3072 node_modules/vite/bin/vite.js build
```
