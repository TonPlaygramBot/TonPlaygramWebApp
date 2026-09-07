# Tirana Streets career, Racing Royal atlas and Dajti

This review branch builds on merged PR #25763 (`194117e5810cadb951bcb9e8bb0905bb6481740d`). It does not deploy or merge production. The current OSM `WORLD`, authoritative collision data, racing circuits and paid multiplayer services are not replaced.

## Actual entry points

Tirana Streets uses `blackwater/ui.tsx`, not the retired driving sandbox. Its existing operation and map UI is preserved byte-for-byte as `operationUi.tsx`. A solo CAREER / CITY STORIES entry switches to `CareerGame` and unmounts the operation engine first. `?activity=career` selects it directly. Online always retains the existing operation runtime and ignores local career selection. There is never an intentionally simultaneous operation and career camera/loop.

Racing Royal preserves its previous UI as `BaseKartRoyale.tsx`. The public wrapper adds `RacingAtlas`. The atlas displays the full stored track centreline, player travel direction, underlying Tirana roads/building footprints, search and saved favourites. **It does not pause a race**; the dialog warns that racing continues. No lake or Dajti racing circuit has been invented. `tiranaScenery.ts` mounts the same civic and mountain visuals as the FPS city adapter.

## Original solo career

Six sequential chapters: A name in the square; After the rehearsal; The missing ledger; Light and stone; Before the doors close; Above the city. Actions include talking to fictional contacts, delivering parcels, observing landmark exteriors and completing a cable-car excursion. One chapter has a 360-second gameplay timer. Checkpoint and elapsed-time saves, sequential unlocks, retry, replay and duplicate-reward prevention are implemented. All six first completions total 1,010 **local career credits, not TPG**.

This is an initial on-foot exploration/courier campaign, not a GTA 6 recreation or an equivalent production-scale game. It does not introduce a vehicle-driving campaign, wanted/police simulation, cinematic dialogue, citywide criminal institutions or new combat missions. Real civic building names are wayfinding references; contacts and jobs are fictional.

The runtime reuses the existing `makeCityWorld`, `GameInput`, `GameAudio`, collision and route modules. It uses a fixed 60 Hz movement loop, camera-relative controls, collision-tested access points on existing roads/paths, line-of-sight and distance checks for interaction, and a personal route line. Missing source access points disable the affected chapter. Checkpoint saves do not teleport the player to an unvalidated location. Device storage failures are reported. Local career progress is separate from the server/stake/career schemas of other modes.

## Reused glTF humans and original assets

Career contacts load `/assets/tirana-streets/living/human.glb`, the existing Adobe/Mixamo Soldier rig used by Tirana/Chess. Embedded material maps are preserved, each contact gets its own skeleton clone and Idle animation mixer, and nearby contacts turn toward the player. Failed/pending glTF loads do not silently become procedural substitute humans. The mesh still has its existing clothing; this is not a new bespoke civilian cast. Its game-use licence is not CC0: see `webapp/public/assets/tirana-streets/living/ATTRIBUTION.md`. Do not redistribute that existing human in standalone model packs.

Six NEW original glTF files can be exported from the same definitions parsed at runtime:

- `culture-bay`, `bank-bay`, `civic-bay`: detailed frontage modules, **not complete new landmark buildings**. They target the exact existing OSM IDs 1249637844, 236566880 and 175108137. Recorded footprint edges stay fixed; decorative dimensions and appearance are authored.
- `gondola`, `station`, `belvedere`: a cable-car cabin, a reusable terminal structure and an approximate upper-terminal hotel building.

All are actual glTF 2.0 with embedded geometry, normals, UVs and PBR parameters. The three small limestone/brick/ochre PNG tiles are original generated textures, not satellite/Street View pixels. Original textures and glTF bytes require no CDN, key or service at runtime. The existing human does load its self-hosted GLB.

## Dajti: map anchors versus authored relief

Both games receive a regional skyline mesh, two modelled stations, twin cable lines, authored supports, animated glTF gondolas and an approximate hotel. The source-mapped horizontal terminal coordinates are:

- Lower: 41.35078, 19.86106, OSM node 1911239826, read via https://mapcarta.com/N1911239826.
- Upper: 41.36842, 19.90559, OSM node 8956716488, read via https://mapcarta.com/N8956716488.

These five-decimal mirror records are **not survey-accurate registrations**. The operator's references are https://dajtiekspres.com/getting-here/ and https://dajtiekspres.com/dajti-tower-belvedere-hotel/. No claim is made that the hotel offset, station yaw or all physical support positions match a present-day survey.

The relief is a mathematical authored mountain, **not a DEM**. Vertical terminal heights, support positions, cable elevation profile, slopes, terminal architecture and hotel offset are approximations. A terrain corridor seats the terminal platforms and maintains 6–32 m modelled cable clearance; that is a geometry-consistency constraint, not measured real-world clearance.

The final career chapter explicitly transfers the view from the central-city access point to an off-map Dajti excursion. The camera rides inside a glTF cabin for 90 seconds of game time and then returns to the city. Cancellation gives no completion reward. It is not a modelled road journey, a walkable mountain expansion or an exact real-world travel time. Only a fully completed journey advances the chapter.

## Map and imagery review

The existing map gains civic POIs and two off-district Dajti station records. Dajti records cannot produce a false walking route through missing infrastructure. Each selected place has separate Satellite, Street View and OSM reference links plus coordinate readout. These open externally; no Google pixels or proprietary geometry are copied into game assets. Decimal display precision is not positioning accuracy.

**A new citywide satellite/Street View registration was not completed.** The feature exposes reference tools and preserves known source positions, but it does not make every building perfectly aligned with present-day Tirana. Source map bounds, full lake geometry, park roads, bridge layers and navigation topology still need the outstanding expansion work. The lake remains incomplete. There is no hidden scaling of Dajti into central Tirana.

## Reproduce

```sh
node --test test/tiranaCareerExpansion.test.mjs test/tiranaMap.test.mjs test/tiranaDetailKit.test.mjs test/tiranaLakeSource.test.mjs
node scripts/check-tirana-career-syntax.cjs
node webapp/scripts/export-tirana-expansion.mjs /tmp/tirana-expansion-models
blender --background --python webapp/scripts/blender/build_tirana_civic_dajti.py -- /tmp/tirana-expansion-models /tmp/tirana-civic-dajti.blend
```

The syntax checker requires the project's TypeScript installation. Blender imports the original exported glTF into editable named collections and saves a .blend. **Blender was not installed in this environment: only Python syntax compilation was performed, and no .blend export is claimed.**

## Validation evidence and remaining gates

Executed locally on Node 22.16.0: **67 tests passed, 0 failed** (28 new career/geography/glTF tests and 39 existing map/detail/lake-staging tests). These exercise progression, checkpoint saves, timeouts, idempotent rewards, input/LOS/distance contracts, exact-ID lookup, coordinate transforms, cable endpoints/lanes/clearance, embedded glTF buffers, materials, indices and transformations. Tests use labelled small geography fixtures, not the full live WORLD or a browser.

Eleven changed TS/TSX modules passed TypeScript transpilation syntax diagnostics. This is **not dependency-aware typechecking**. All six exported glTF files were independently parsed with Python trimesh and checked for finite vertices, positive triangle areas and consistent normals/winding. Offline CPU model renders are review illustrations, not Three.js/game screenshots.

Still required before release: dependency-aware typecheck and full webapp build; actual React/Three browser runs of both games; full-WORLD mission access/LOS and contact animation checks; Dajti cabin/terrain visual registration; race-atlas gesture and race-state review; source/Blender verification; actual mobile GPU, memory, FPS, touch and thermal measurements; existing FPS/racing multiplayer regressions. No successful CI run, production deployment or full gameplay certification is claimed. Keep the PR in draft until these gates are resolved.
