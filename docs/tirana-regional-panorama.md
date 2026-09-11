# Tirana regional atlas and Dajti panorama

## Scope and outstanding work

This PR is a partial implementation of the whole-city expansion request. It does
**not** ship continuous playable terrain, roads or buildings in Rinas, Vaqarr,
Sauk, Farkë or the intervening outer Tirana districts. No regional OSM snapshot
or DEM was acquired in this environment: outbound acquisition requests were
blocked. Do not merge this as a completed whole-city reconstruction.

The original WORLD origin, bounds, footprints, navigation and physics are retained.
The acquisition/atlas envelope expands to 19.680–19.980 E, 41.240–41.460 N. This is
an authored collection envelope, not an administrative boundary. It includes all
requested named areas. The separate atmospheric coast is outside this envelope.

## Changes in the actual game

- Greater Tirana includes Rinas airport, Vaqarr, Sauk and Farkë references alongside
  Kamza, TEG and the existing Dajti terminals/summit. Reference descriptions state
  whether a coordinate denotes an airport, settlement or administrative unit.
- The shared enhancement layer lazily creates a merged distant LOD from the same
  1,377 WORLD building footprints. Existing high-detail culling previously hid the
  centre from Dajti. The new four-draw backdrop bypasses local street fog, only at
  altitude and within 22 km of the centre. No invented outer-city blocks are added.
- An authored faint Adriatic patch and Durrës silhouette lie west of Tirana at
  geographical scale, with a temporary 65 km camera far plane. Their shapes and
  heights are **not** digitized coast, surveyed buildings or DEM elevations.
  The distant sea height (-110 in the existing local frame) is an artistic datum
  approximation. No horizon visibility/occlusion survey is claimed.
- After the career gondola journey completes, the player can remain at the upper
  station, look around and explicitly return. Arrival looks back towards Tirana.
  This is a stationary panorama, not newly walkable mountain terrain. Completion
  still uses the existing career reducer and cannot repeatedly award credits.
- The regional atlas can open a lazy React + Three.js panorama review. The same
  component has a standalone development entry, `tirana-panorama-preview.html`.

## Source review, 2026-09-11

- [Dajti operator: Ballkoni Dajtit](https://dajtiekspres.com/facilities/restaurant-ballkoni-dajtit/)
  confirms the cliff-side restaurant overlooks Tirana and, on clear days, Durrës
  and the Adriatic. It describes the restaurant as just over 1,000 m above sea
  level and its construction as log-cabin inspired. These statements support
  panorama direction and atmosphere, not a measured terrain model.
- [Dajti Tower operator](https://dajtiekspres.com/facilities/dajti-tower-hotel/)
  places the hotel below the upper station and describes a viewing terrace.
- [Airport reference](https://en.wikipedia.org/wiki/Tirana_International_Airport_N%C3%ABn%C3%AB_Tereza),
  [Vaqarr](https://en.wikipedia.org/wiki/Vaqarr),
  [Sauk](https://en.wikipedia.org/wiki/Sauk,_Albania),
  [Farkë](https://en.wikipedia.org/wiki/Fark%C3%AB) and
  [Durrës](https://en.wikipedia.org/wiki/Durr%C3%ABs) provide published point
  references. Rounded settlement positions are not suitable as building anchors.
- Google Maps was manually inspected for Vaqarr. Satellite imagery showed SH56,
  agricultural parcels, hillside housing, the secondary school and mosque.
  The school's visible place photograph showed light façades with dark red/brown
  façade panels and a fenced frontage. These are visual review observations;
  no Google imagery, traced geometry or place database is bundled in this PR.
  Street View opened on SH56 at 41.3043855 N, 19.7482561 E (June 2025 imagery);
  the inspected view showed curbs, vegetation and a metal roadside fence.
  No exhaustive citywide Street View survey was performed.
- Existing public/government buildings and business façades retain their original
  source registries and asset definitions; no additional measured regional
  building model is claimed.

## Reproducible source acquisition

Run from the repository root with an actual past UTC snapshot date:

```
node webapp/scripts/acquire-tirana-region.mjs /path/to/acquisition 2026-09-11T00:00:00Z
```

This is an explicit authoring command, never a game-load or build hook. It requests
30 bounded tiles sequentially, fixes the Overpass historical date, caches raw JSON
and query/hash/timestamp receipts, and resumes verified tiles on rerun. A failed
request produces no new completed regional-review output. Conflicting duplicate OSM
identities, partial responses and source elements newer than the requested snapshot
fail rather than silently produce a stitched map. Database freshness timestamps
can differ even when all queries ask for the same historical date.

Queries include roads, buildings, water, businesses, amenities, government offices,
tourism, historic features, aeroways and coastlines. The review importer now
retains public-place points, outlines, relations and full tags. A school campus
relation remains a relation; it is never extruded as a solid building. Unknown
heights remain unknown. The result remains `runtimeReady:false` pending DEM,
bridge/tunnel, topology, geometry coverage and collision integration.

Full region promotion needs licensed terrain with a stated vertical datum;
reviewed building heights and road access; tile streaming and collision across
boundaries; routes to all named areas; and actual phone validation. Those gates
are outstanding, not implied by passing source tests.

## Validation

Executed locally:
- 85 tests across the regional source, regional validation, atlas, career and new
  panorama suites passed. The new runtime tests exercise the actual career tick,
  single completion, overlook/return behavior, real Three.js mesh creation,
  altitude gating, camera clipping restoration and geometry disposal.
- Dependency-aware TypeScript check of the changed panorama/atlas/career entry
  points passed (bundler resolution, ES2022, skipLibCheck; not a repo-wide check).
- Production Vite build passed. The normal prebuild asset acquisition hooks were
  skipped because this environment blocks outbound asset acquisition. Large
  existing bundle warnings remain; this is not a full asset-availability check.
- The 650 KB inline preview bundles the actual panorama component and current
  source footprints, not a mock screenshot. Remote Browser could not open the
  local preview URL (ERR_BLOCKED_BY_CLIENT). Actual in-browser appearance,
  phone FPS, GPU memory, context loss and end-to-end game interaction are not
  verified. Keep this PR draft pending those checks and the missing GIS data.
