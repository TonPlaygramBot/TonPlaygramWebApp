# Tirana Streets + Racing Royal — audit and verified repair package

**Repository:** TonPlaygramBot/TonPlaygramWebApp  
**Audited commit:** `3c5ac8c5df45f07865d37ce7dc5833ef3142a2f7`  
**Date:** 9 September 2026  
**Release status:** DRAFT PR · REVIEW REQUIRED · NOT MERGED OR DEPLOYED

## What this delivery is—and is not

This package contains actual source fixes made against seven SHA-verified repository files, regression tests, deterministic racing-simulation evidence and a professional brief for the remaining major upgrade. It is not a full checkout, not a new game, not a live preview and not a completed city/character/arsenal/track expansion.

At the initial audit, the connected GitHub interface provided read actions but no commit/PR write action. The subsequent publication session exposes write actions; this PR publishes the accompanying source fixes and tests without merging or deploying them. Direct source/dependency downloads were blocked in the execution environment. A Chromium portrait access attempt at the repository's default candidate frontend URL was also blocked by `ERR_BLOCKED_BY_ADMINISTRATOR`. That does not demonstrate that the real app is broken or offline. The default can be overridden in deployment; it is not proof of the production address.

## Executed results

| Verification | Result | What it establishes |
|---|---|---|
| Original runtime regression set | 3 pass / 7 fail before; 10 pass after | Actual transpiled method control flow with graphics/loader fixtures |
| Original racing regression set | 7 pass / 6 fail before; 13 pass after | Sample-density invariance, indexing, map/circuit compatibility |
| Expanded final regression set | **46 pass / 0 fail / 0 skipped** | 23 runtime fixtures, 13 racing tests, 10 metric tests |
| Baseline driving matrix | 18 races, 108/108 karts finish | Original shared physics, AI, kart contacts and track-wall response |
| Upgraded driving matrix | **18 races, 108/108 karts finish** | Same six tracks × three difficulties × six karts |
| Full upgraded driving retest | 18 races, 108/108 karts finish again | Repeatability after expanded checks/instrumentation review |
| TypeScript transpilation | Checked for changed runtime TS modules | Syntax/transpilation, not dependency-aware typechecking |
| Actual Three.js integration gate | **Not verified: dependencies unavailable** | Separate test file supplied; no passing result claimed |
| Full app production build | **Not run** | Full checkout/dependencies unavailable |
| Browser portrait gameplay | **Blocked before page load** | No real gameplay or screenshot assessment possible |
| Physical phones / WebGL / GPU profiling | **Not run** | No device-FPS, thermal, GPU-memory or visual-quality claim |
| Live multiplayer / TPG economy | **Not run** | No networking/economy certification |
| Publication | **Source fixes and tests submitted for draft review** | No merge or production deployment |

### Meaning of the simulation metric

A wall-contact racer-frame is one 1/60-second simulation step in which an active, non-finished, non-retired kart is marked in contact with the track wall. It is **not** a unique crash count, a GPU frame-time metric or evidence of building collision accuracy. Under the final matching deterministic scenarios, this count fell from **50,028 to 10,912 (78.2% fewer)**. No physics timestep, race timeout, kart invulnerability, teleport or player steering change was used to manufacture finishes.

Skënderbej's mean finish times increased by approximately 12.5–13.0 seconds across its three difficulties. Other tested circuits finished faster. Minimum remaining kart health was no worse in the final matrix. The Skënderbej tradeoff requires actual player/difficulty review; lower wall contact is not a complete gameplay-balance acceptance criterion.

## Confirmed findings and implemented changes

### 1. Character retry can duplicate work

`SharedHumans.retryFailed()` cleared request-deduplication entries for every model not yet cached, including queued/in-flight models. Repeated retries could enqueue duplicates and overwrite a successful source. The patch tracks failed sources separately, retains in-flight ownership, retries failures only and deduplicates private skeleton disposal. A late completion after disposal still releases its source instead of installing it.

**Scope:** loading reliability for the existing shared-human layer. No new character models or Battlefield/Operation adapters were added.

### 2. Imported glTF appearance was being discarded

The old weapon loader ignored meshes whose material was an array and removed every vertex attribute except position, normal and the first UV set. It also silently lost a batch when geometry merging failed. These are source-level paths capable of dropping model parts, vertex colors, extra texture-coordinate sets and tangent data.

The new `weaponModelResources.ts` conservatively batches compatible rigid meshes while preserving their attributes and material references. Complex material groups, skins, morphs, mirrored transforms, hidden branches and partial draw ranges retain the original scene. Failed merges retain the original model. Empty/invalid bounds fail explicitly rather than caching an infinite scale. A separate normalization frame preserves imported root transforms.

**Limit:** these paths passed control-flow fixtures, not real asset rendering here. Conservative preservation can cost additional draw calls. The supplied real-Three gate and actual model/grip/PBR review remain mandatory.

### 3. Rapid switching could display the previous weapon

The old `pose()` kept the old mesh visible while a newly selected model was unavailable, while using the newly selected weapon's configuration. The patch clears/hides the stale instance until the correct cached model is available, installs only the currently selected model, uses skeleton-safe cloning and prevents disposed layers from recreating holders. A failed asset can be explicitly retried without duplicating an in-flight request.

**Limit:** this is an identity-correctness fix, not a new visible loading-indicator UI. The current selection can temporarily have no visible held model while loading. Existing generic fallback mappings, such as Molotov/gas-tank/dynamite to a grenade mesh, remain unchanged and are not represented as exact-asset parity.

### 4. Weapon resource cleanup was not an ownership boundary

The old disposal path could dispose shared geometry/materials/textures repeatedly, retained holder/model references and did not guard repeat disposal. The patch detaches holders, frees private skeletons, deduplicates geometry/material/texture disposal and clears owned caches idempotently. Late weapon loads after disposal are freed and never cached.

**Limit:** no physical GPU-memory or ImageBitmap/driver lifetime measurement was performed. This is not proof that all application memory leaks are eliminated.

### 5. Racing AI treated unequal samples as equal distances

The source resampler preserves mapped corners, producing nonuniform segment spacing. The old AI nevertheless used `track.length / 360` to choose lookahead and estimate upcoming corner distance. The new shared metric module uses actual cumulative segment lengths, within-segment projection and interpolation. Steering and braking now use physical distances. A test varies sample density without changing the rectangle's physical geometry and verifies identical steering.

The geometry, track IDs, 360-sample/lap-gate contract, collision implementation and player control signs are retained. This is an AI/path precision change, **not a physical track expansion**. Because AI code is shared, review and deploy matching client/server versions before new matches; do not hot-swap rules into active paid matches.

### 6. Valid small authoring counts used negative indices

`resampleCircuit()` accepted small valid counts but its start-line scan used a modulo expression that could return negative array indices. The patch uses positive wrapping. Counts 3–7 now work on a valid triangle; the existing 360-point routes retain their exact corners and length.

**Scope:** authoring robustness. This did not break the shipped 360-sample circuits and is not presented as a live-track crash.

## Remaining major-upgrade work

**Shared characters:** inventory all eligible full-body Games-page assets, check rights/rig compatibility and integrate them into the intended Tirana modes and actor roles. Current shared-human loading repairs do not automatically reskin Battlefield, the player or traffic drivers.

**Complete Ludo arsenal:** audit capture IDs, shared model IDs, aliases, exact meshes/materials, support vehicles/aircraft, UI availability and authoritative gameplay adapters. Existing IDs are not proof of exact model parity. This patch adds no weapon catalog entries or support-item gameplay.

**Tirana city realism:** no new city GLB, PBR texture, landmark mesh, road layout, façade or street-furniture asset is included. Preserve existing OSM coordinates/anchors and provenance, add licensed assets through a measured LOD/streaming pipeline, and inspect the actual city at pedestrian and kart camera heights. Textures alone cannot correct inaccurate silhouettes or placement.

**Physically larger circuits:** no new route was enabled. Existing measured lengths are approximately 1,876 m Skënderbej, 1,063 m Blloku, 1,448 m Lana, 984 m Pyramid, 880 m Stadium and 1,994 m Lana–Pyramid Grand. The catalog still exposes six tracks and rejects unvalidated Grand variants. The offline extension helper's defaults also conflict for Skënderbej: 1,876.38 × 1.4 ≈ 2,627 m exceeds its default 2,200 m cap. Resolve authoring limits with source-backed roads, clearance checks and new versioned IDs—not geographic scaling or more laps.

**City/track clearance risk:** the current catalog uses a uniform 12 m race width. These tests establish ribbon driving, not that every barrier clears every mapped building/curb/riverbank. No overlap is asserted without a city clearance test.

**Mobile polish and performance:** actual portrait HUD/touch, animation/grip, camera, audio, loading, thermal/memory, Telegram webview, online rejoin and full build checks remain release gates. Do not label this package the finished “best mobile game.”

## Detailed final driving comparison

| Circuit | Difficulty | Active wall-contact frames | Mean finish time | Upgraded finishes |
|---|---|---:|---:|---:|
| skanderbeg | rookie | 1,544 → 378 | 313.57 → 326.61 s | 6/6 |
| skanderbeg | street | 1,624 → 339 | 286.86 → 299.33 s | 6/6 |
| skanderbeg | pro | 1,451 → 346 | 273.90 → 286.86 s | 6/6 |
| blloku | rookie | 3,560 → 161 | 187.67 → 183.27 s | 6/6 |
| blloku | street | 3,437 → 166 | 171.05 → 167.31 s | 6/6 |
| blloku | pro | 3,295 → 149 | 163.43 → 160.21 s | 6/6 |
| lana | rookie | 3,365 → 1,181 | 237.65 → 233.92 s | 6/6 |
| lana | street | 3,198 → 1,196 | 218.06 → 214.97 s | 6/6 |
| lana | pro | 3,082 → 1,103 | 208.27 → 205.24 s | 6/6 |
| pyramid | rookie | 2,042 → 170 | 168.74 → 162.19 s | 6/6 |
| pyramid | street | 2,088 → 291 | 153.11 → 147.14 s | 6/6 |
| pyramid | pro | 1,950 → 259 | 145.16 → 139.32 s | 6/6 |
| stadium | rookie | 1,168 → 389 | 254.79 → 252.23 s | 6/6 |
| stadium | street | 1,213 → 403 | 245.91 → 242.98 s | 6/6 |
| stadium | pro | 1,083 → 390 | 240.71 → 239.17 s | 6/6 |
| lana-pyramid-grand | rookie | 5,418 → 1,282 | 335.64 → 331.92 s | 6/6 |
| lana-pyramid-grand | street | 5,218 → 1,256 | 307.44 → 303.93 s | 6/6 |
| lana-pyramid-grand | pro | 5,292 → 1,453 | 292.91 → 290.19 s | 6/6 |

## Reproduce from this PR

Use Node 22 and the existing webapp dependencies. The first command executes control-flow fixtures and mathematical checks, not WebGL. The second runs actual shared racing physics.

```sh
NODE_PATH="$PWD/webapp/node_modules" node --test test/mobile-upgrade-runtime.test.cjs test/racing-precision.test.mjs test/circuit-metrics.test.mjs
RESULT_JSON=upgraded-driving.json node test/driving-matrix.mjs
node --test test/mobile-upgrade-three.integration.test.mjs
npm --prefix webapp run build
```

The 46-check regression command was rerun successfully before publication: 46 passed, 0 failed, 0 skipped on Node 22.16.0. This does not upgrade the unverified real-Three, full-build, browser, physical-phone or multiplayer results above into passing checks. The original downloadable package retains its baseline files, hashes and raw evidence.

Keep the PR draft until dependency-aware checks, real-library geometry checks, actual asset rendering, mobile gameplay and network regressions pass. Review the Skënderbej AI balance tradeoff. Shared client/server AI must be rolled out together for new races; do not replace rules in active paid matches.

## Source traceability

All baseline files below were retrieved from the pinned repository and reconstructed byte-for-byte, then checked against their Git blob SHA. `BASELINE-SHAS.json` contains the exact hashes. The patch changes four existing runtime sources and adds the weapon-resource helper and distance-metric module/declarations; other copied baseline files are reproduction fixtures, not edits.

- `webapp/src/games/tiranastreets/livingVisuals.ts`
- `webapp/src/games/tiranastreets/street-career/SharedHumans.ts`
- `webapp/src/games/kartroyale/legacySimulation.mjs`
- `webapp/src/games/kartroyale/grandRouteCore.mjs`
- `webapp/src/games/kartroyale/tirana-routes.mjs`
- `webapp/src/games/kartroyale/collisions.mjs`
- `webapp/src/games/kartroyale/raceCatalog.mjs`

Additional audited context: `docs/tirana-game-repair.md`, `docs/tirana-street-career.md`, `docs/tirana-fps-city.md`, `webapp/src/config/snakeWeaponCatalog.js`, `webapp/src/config/ludoWeaponDirectorBridge.js`, Tirana `shared/weapons.mjs`, and `bot/commands/start.js`. Their implementation or asset coverage is not claimed complete by this patch.

Technical reference: Three.js GLTFLoader and KTX2Loader documentation (https://threejs.org/docs/pages/GLTFLoader.html and https://threejs.org/docs/pages/KTX2Loader.html). The project API baseline is Three.js r164; current documentation does not justify a silent engine upgrade.

No binary assets, font files, account data or credentials are redistributed in this package. Existing geography/license headers are retained. Review the complete professional prompt for acceptance gates and the remaining asset/gameplay work.
