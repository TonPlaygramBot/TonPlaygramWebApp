# Tirana Streets loading correction

Based on `main` at `a6e3e3266106e6c22e73b729158b8a16fb27eaf7`, following #25957.

## Failure reproduced

The deployed game returned all 48 required lazy JavaScript/CSS resources successfully, then its main thread stopped responding during city preparation. The 12-second Suspense message is informational; it does not abort or retry the import. Raising that timer would not fix the work blocking the game.

A production Vite route test reproduced a 60.6-second operation import and 112.6 seconds from opening the picker to interacting with settings. A separate native browser import, without mounting gameplay or a GPU scene, took 61.1 seconds. Its CPU profile identified full-map searches in street fixture placement and battlefield spawn placement. The new all-city geometry allocation and guard placement added further synchronous work. A blocked Google Fonts `@import` also rejected Vite's required Career stylesheet preload.

## Changes

- Index source records at construction; generate nearby complete building/road districts cooperatively. Keep complete footprints, roofs, courtyards and boundary road segments through a 2.2 km radius. Evict distant geometry, dispose cancelled work and prioritize basic coverage before ornament. Coverage fills over subsequent frames, including after teleports; gameplay does not wait for every distant district.
- Yield within a single long hillside road and cap surface geometry allocations. The terrain triangles, winding and heights remain identical.
- Use conservative spatial candidates for institution identification, guard road exclusion, street fixtures, bridge/river checks, battlefield roads and obstacle clearance. Preserve exact final geometry predicates, original ordering and tie handling.
- Career reads the six baked imported visual placements directly, without evaluating all battlefield deployment locations.
- Display complete small mosque exterior masses immediately. Load both Blender detail levels optionally, retain fallback geometry on failure and dispose late results safely.
- Split the character preview from the initial lobby bundle, retain loading/back controls and catch preview chunk errors in the existing game error boundary.
- Remove Career's remote font import; retain its existing font fallback stacks. Log game-module start, success and failure separately from scene construction.
- Keep the slow-loading status informative: loading continues, so the player can wait instead of repeatedly restarting the same work. The 12-second timer is unchanged.

## Correctness and measurements

These are development-machine measurements, not phone FPS or memory guarantees.

| Check | Before | After | Preserved result |
| --- | ---: | ---: | --- |
| Street fixture module import (Node) | 16.56 s | 4.48 s | All 11,529 props and 21,223 colliders byte-identical |
| Battlefield layout evaluation (Node) | 26.79 s | 11.42 s | All 113 starts/extractions and 29 fleet/prop records identical |
| Place resolution (same Node process) | 1,498 ms | 84 ms first / 3 ms reused | 236 source sites and 17 issues identical |
| Guard road placement (shared CPU; frontage cache warm) | 4,809 ms | 66 ms | All 206 guards identical with actual engine collision handling |
| Added district constructor allocation (Node microbenchmark) | About 327 MiB | About 3 MiB | Complete geometry is now generated only around the viewer |
| Long rural road generator step | 74–106 ms | 1.05–5.25 ms | Identical Float32 terrain vertices; surface mesh at most 3,072 vertices |

The fixture comparison hashes are `8d2cb275ee73dcfd977fcf27d31dfec015f96c425c88774aa604da9c75257f08` (props) and `685d9768f6b6045a2ec8d78d6d7a74d28b2aebeee3f4c532d00884b144de0137` (colliders). The guard hash is `8af10c70a863666f0f23c2c4d7937c1f49ab6a91badd39f128c0ca648deeabae`.

## Reproduction

```sh
node --test test/tiranaDistrictStartup.test.cjs test/tiranaMobileWorldUpgrade.test.cjs test/tiranaLobbyLoading.test.mjs test/tiranaFixtureSpacing.test.mjs test/tiranaLayoutSpatial.test.mjs test/tiranaPlaceResolution.test.mjs test/tiranaInstitutionGuardIndex.test.mjs test/tiranaRuralRoadBudget.test.cjs
cd webapp && npx tsc --noEmit -p tsconfig.tirana-gameplay.json
```

`test/tiranaProductionLoading.browser.mjs` builds actual Vite-split game routes, uses the real player picker and continuous WebGL rendering, blocks optional mosque detail downloads, and checks the operation board/settings and playable Career controls. Only account responses are fixtures. Its optional `TIRANA_TEST_ASSET_ORIGIN` supplies public assets missing from a sparse checkout. Set `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when Playwright is installed outside the repository.

All 28 focused tests and the Tirana gameplay TypeScript check pass. Browser checks pass for Operation board/settings, Career loading completion and MENU → RESUME, and the recovery screen after a blocked character-preview chunk. Optional mosque detail was blocked in both modes. The Operation module took 20.28 s and settings responded at 49.86 s from entry; Career took 10.84 s and reached ready/resumed controls at 54.39 s. These runs used continuous software WebGL at 320 × 740. Three optional actor request cancellations remain recorded in `docs/validation/tirana-loading-fix/production-loading.json`; no page errors occurred. The earlier held-weapon failure did not reproduce with the real critical model files present; no weapon data or timeout policy was changed.

The full app Vite production source build passes, including all four configured HTML entry points. Its manifest also confirms that the far mosque model is outside both games' required static dependency graphs and Career's emitted CSS has no Google Fonts dependency. Public-directory copying was disabled for this sparse checkout; native game-pack generation and deployment were not run. The existing large-chunk warnings remain, along with missing unrelated public-image/CSS references in the sparse checkout.

This fixes required loading dependencies and large startup stalls. It does not promise instant startup: the map is still large, and the existing slow-loading message can appear on slower devices. Real phone, Telegram WebView and native offline-pack checks remain necessary before production release. No deployment is part of this change.
