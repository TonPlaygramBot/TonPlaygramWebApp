# Tirana Streets canopy, pavements and city streaming

Base: `main` at `271848bf5961e8eed59f93cdedc2b64c0e1f0aa8` (12 September 2026).

The subsequent neighbourhood work is documented in `tirana-neighbourhood-realism.md`. Its 1,918 estimated green-space trees are additional to the measured/row-based counts below and remain labelled separately.

## Vegetation and evidence

The existing OSM archives contain 10,702 individual tree nodes and 68 tree rows. The supplement adds **110 placements**: two previously unowned mapped trunks and 108 samples on recorded tree-row alignments. Arc-length spacing now carries through short source segments instead of restarting on every segment. A dynamic occupancy index rejects duplicate samples across rows and existing layers. Conflicts with roads, buildings and water are omitted, never moved to a fabricated position.

The original mapped trees, mature trees and city-completion trees now have **10,850 distinct render owners**. Original mature dimensions and source coordinates are retained. There are 191 source-backed placements near the central Lana corridor (102 and 89 on its two sides, within channel half-width plus 17 m, world X between -1300 and 1300 m). This count describes the dataset, not a complete physical inventory. Trees already in the source but previously lost to short draw distances remain visible farther along both banks and streets.

**The request to locate every missing Tirana tree precisely from satellite imagery is not complete.** ASIG's [data catalog](https://geoportal.asig.gov.al/en/data) and [services catalog](https://geoportal.asig.gov.al/en/services) were found, but page access failed with redirect loops and direct imagery/service requests timed out. The alternative Esri World Imagery service also timed out. No satellite pixels were obtained or inspected, and no new point is described as satellite-detected. A usable georeferenced orthophoto or accessible imagery service is still needed for a per-tree survey. Row sampling and unmeasured crown/height values remain explicitly labelled estimates. Woodland scatter and arbitrary roadside rows were not added as substitutes for measured trunks.

The complete source hash, acquisition date, omissions and limitations are in `tirana-canopy-coverage.json`. Rebuild the supplement with `node webapp/scripts/build-tirana-canopy.mjs`.

## Pavements

`UrbanRoadCells` now owns road and pedestrian surfaces in the central and extended city. Pavements subtract the complete carriageway mask, including crossings and adjacent cells, and preserve channel cutouts. Bridge decks and bridge sidewalks remain with `InfrastructureLayer`. Large-building aprons and the Murat Toptani stone finish use the same road exclusion.

The old baked `pavement_network` and fixed-world-X pavement tiles are no longer added on top of the updated map. Source road endpoints, widths, routing and collision geometry are unchanged. Convex half-plane subtraction handles the common road rectangles without a polygon sweep; concave polygons retain the polygon library. Rare channel seam failures retry at millimetre precision rather than crashing the scene.

## Larger area with bounded work

| Layer | Before | After, normal quality | Battery |
| --- | --- | --- | --- |
| Streamed road radius | 1,200 m | 1,800 m | 1,100 m |
| Mapped building radius | 1,050 m | 1,800 m | 1,100 m |
| Mature canopy radius | 340 m | 1,400 m | 850 m |

- Road and building queues process incremental work, targeting 4 ms per update (2 ms on battery). This is a CPU work target, not a hard real-time guarantee.
- Building walls and roofs are written directly from source footprints for distant cells. Close cells gain windows and roof trim; detail meshes are merged by material. Courtyard holes and source heights remain intact.
- Tree LOD has close leaf cards, middle-distance crowns and very cheap distant silhouettes. Geometry budgets are 64 detailed, 384 medium and up to 6,000 selected trees per layer, with lower battery limits. Unchanged viewers do not rebuild instance matrices every frame.
- Cache eviction also runs after new cells finish, so a stationary player after a teleport cannot retain two full regions. Normal/battery cell ceilings are 270/140 per road or building layer; retired generators release partial geometry.
- Street-fixture building checks use a footprint index instead of scanning all 45,920 footprints per candidate.
- The legacy city renderer now attaches the shared neighbourhood/canopy enhancements too. Street career reuses the same layer with a single update/disposal owner. FPS, street and social cameras have enough far range for the new city radius.

For 300 real mapped buildings, the retained full-detail builder generated 71,355 triangles in 159.55 ms; direct distant shells generated 9,017 triangles in 15.22 ms (87.4% fewer triangles). These are one container CPU comparison, not a device FPS promise; see `tirana-canopy-performance.json`. The targeted road-stream test's worst update was approximately 5 ms after constructor/index preparation. Initial index construction, GPU rendering, asset decode and other game systems are outside that number.

## Preview and verification

The portrait React/Three.js preview uses the actual changed road, tree, building and river classes. It embeds a bounded 2.4 × 2.7 km subset with 4,092 buildings, 20,529 road segments and 5,698 trees. Lana, boulevard and panorama views, orbit/pinch and the battery toggle are available. Building finishes are simplified and traffic/gameplay are omitted; this is an environment review, not an end-to-end game session.

```sh
node --test test/tiranaCanopyStreaming.test.mjs test/tiranaEnvironment.test.mjs test/tiranaNeighbourhoodRuntime.test.mjs test/tiranaCityCompletionRuntime.test.mjs test/tiranaStreetLife.test.mjs test/tiranaFpsCity.test.mjs
node webapp/node_modules/typescript/bin/tsc -p webapp/tsconfig.neighbourhood.json
npm --prefix webapp run build
node webapp/scripts/build-tirana-canopy-preview.mjs
```

The six test files passed **31 tests**. The final cache/courtyard follow-up passed the eight canopy-streaming checks. The neighbourhood TypeScript check and production build passed. The tree ownership assertion was updated for its deliberately wider scope, while original trunk coordinates/dimensions checks remain. The existing no-GPU neighbourhood fixture gained an `Image` stub for the local logo added by the previous main commit; a park furniture download warning remains expected in this Node-only fixture.

A broader experimental type check including the legacy/social renderer exposed five existing missing declarations for `weatherCore.mjs`, `socket.js`, `importedAssets.mjs` (two importers) and `chessBattleInventoryConfig.js`. The new code produced no additional errors in that check. The mixed JS/TS application is validated by the production bundler as before.

Browser WebGL screenshots and physical phone gameplay/FPS were **not verified**: the browser control tool was not exposed, no local Chromium executable was present, and downloading the browser timed out. No production deployment or merge is part of this change. Review the portrait preview and phone performance before merging.
