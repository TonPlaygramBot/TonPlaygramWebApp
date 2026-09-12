# Game downloads and Tirana Streets lighting

Base: `main` at `16bf14f` (September 12, 2026). This change is prepared for review; it is not a production deployment.

## Download repair

All 17 Games Lobby entries now resolve to a download pack in both the generated catalog and the browser fallback. Existing Pool/Snooker and Tennis/Table Tennis shared packs remain shared. Each game card exposes a download-management link without changing its normal play route. Download controls have readable labels and 44px touch targets.

The production build generates a hidden shared runtime pack **after Vite** so it includes the actual hashed JavaScript/CSS files and built index. Public game media is now included in each pack alongside models. Native pruning still removes only approved binary assets: media, new shared table-game resources and executable runtime remain in the native shell.

Repairs verified with executable Cache Storage/Fetch simulations:

- All hooks receive the settled install status after the active flag clears.
- Shared dependency progress is visible on the requested game's card.
- `no-store` and `reload` bypass the page interceptor, pack worker and main worker's stale runtime cache. Previously an update could repeatedly receive the old bytes and fail integrity validation.
- Every concurrent writer settles before Resume or removal is exposed.
- A completed-cache marker keeps partially downloaded packs out of runtime reads.
- Failed updates retain the previous installation; completed files can be reused on retry.
- Cancellation before starting, dependency failures, partial device eviction, HTML error-page responses and metadata-cache quota failures have explicit handling.
- Removing an active download waits for cancellation before deleting its files.

These are device-local web/native asset downloads, not individual APK exports. Accounts, online matches and network-only resources still require connectivity. Dynamic assets outside the shipped manifests are not promised offline. Pack totals list each pack's own files; shared files appear as a separate download phase. Small files retain SHA-256 validation; large streams retain the existing byte-size validation policy.

## Tirana environment

- Stream paved aprons around large-building footprints in nearby cells. They render above decorative grass and below road asphalt. Channel cutouts remain open, and mapped parks away from the aprons are retained.
- Remove concrete pedestrian bollards from shared rendering and physics. Stop generating unused bollards. Remove bridge-edge concrete strips while retaining the existing metal rail coordinates, bridge decks, sidewalks and structural supports.
- Instance street poles, arms and bulbs along recorded road segments, with a maximum of six nearby street lights and two shop lights. Battery mode enables at most two street lights and one shop light. No per-lamp shadow maps are added.
- Synchronize street lamps, business windows, signs and apartment emissions with the existing deterministic day/night/weather system. Apartment room/floor occupancy varies in the window shader. Building glass in the reference, aged and imported building layers participates.
- Add wind to the existing weather state and rain shader. Both vertices of a rain streak wrap together, avoiding long streaks at the particle-volume boundary. Existing cloud, fog, wet-surface, exposure and texel-stabilized sun-shadow behavior is retained.
- Explicitly allow available WebGL implementations with a major performance caveat, retaining the existing antialias/high-performance → default-context retry. This cannot enable graphics that the browser or device disallows.

## Sign provenance and limits

Mulliri artwork was downloaded from the [official Mulliri website](https://mullirivjeter.al/), with the exact asset URL, retrieval date and SHA-256 recorded in `webapp/public/assets/tirana-streets/signs/sources.json`. It is used in the shared sign atlas for mapped Mulliri storefronts and selected nearby existing billboard fixtures. The original identity artwork is retained; no offer prices or claims were invented.

The existing OSM tenant names and positions remain the placement source. Branch facade dimensions and roadside advertising mounts are approximate. This is not a claim that every billboard reproduces a current real-world advertisement. Other unverified posters retain their existing city artwork.

## Review loop and validation

1. Diagnosed limited catalog coverage, install-state races and stale cache interception; added recovery tests.
2. Added pavement, roadside removal, lights and weather changes; tested real Three.js scene objects without a GPU.
3. Found decorative grass could cover aprons and corrected the height. Replaced whole-city apron triangulation with bounded streaming. The environment terrain test fell from approximately 6.5s before streaming to under 1s in later runs (container measurements, not phone frame rates).
4. Verified day/night light intensities, battery light budgets, rain bounds, finite instance transforms, pavement height, open river geometry and disposal.
5. Built a portrait React/Three.js environment preview from a bounded area containing 532 mapped buildings. The in-chat version embeds the approved logo, uses the actual changed atmosphere/infrastructure/lighting/pavement code, and uses simplified building materials without remote game-model loading. It is an environment study, not an end-to-end game playtest.

Commands used:

```sh
node --test test/gamePackRecovery.node.mjs test/tiranaEnvironment.test.mjs
node --test test/tiranaStreetDetail.test.mjs test/tiranaStreetLife.test.mjs test/tiranaFpsCity.test.mjs
node --test test/tiranaStreetDetail.integration.test.mjs
node webapp/node_modules/vitest/vitest.mjs run test/gamePackDelivery.test.js --globals --root . --pool=forks --maxWorkers=1 --minWorkers=1
npm --prefix webapp run build
node webapp/scripts/build-tirana-lighting-preview.mjs
```

The final targeted Node run passed 58 tests, the actual-city integration run passed 4, and the delivery-generator Vitest run passed another 3: **65 passing checks**. The production build passed and generated download coverage for all 17 game slugs, including the shared executable-runtime dependency.

The first broader run exposed stale assertions in `test/tiranaStreetDetail.integration.test.mjs`: an old WORLD blob hash, a superseded lobby link and whitespace-sensitive adapter matching. The map guard now pins the unchanged base `main` blob `7dce43d8...`, and the lobby check follows its existing `gameModeURL('streets', 'career')` call. The former concrete-post requirement now verifies that both posts and invisible FPS collision boxes are absent. All four integration checks pass after these explicit expectation updates; neither the map nor lobby implementation was changed to satisfy them.

### Unverified boundary

The cloud browser could not reach the isolated local app (`ERR_BLOCKED_BY_CLIENT`). Automatic approval review rejected the local preview-server network escalation because the session disallows it. Therefore no actual browser WebGL rendering, full game playthrough, physical-phone frame rate, iOS/Android install behavior or production download has been certified in this session. No browser limitation was bypassed, and no 2D fallback was counted as a WebGL test. Those checks remain the reason this PR is a draft.
