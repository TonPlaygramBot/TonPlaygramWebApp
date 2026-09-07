# Shared Tirana landmarks — six original mesh recreations

## Delivered in this branch

Six original, approximate 3D mesh reconstructions are synchronously built into the
Tirana Streets, Racing Royal (`kartroyale`) and BlackWater scene entry points:
Clock Tower, Et’hem Bey Mosque, Pyramid, National History Museum, Eyes of Tirana,
and the Skanderbeg equestrian monument. They are NOT Google Earth extracts,
photogrammetry, or the models linked in the earlier source catalogue.

`nativeModels.mjs` produces the same numeric mesh data used by the Three.js layer
and the GLB exporter. All meshes have normals, PBR material parameters, near/far
LODs and metre-based dimensions. There are no model downloads, external textures,
credentials, runtime map requests or asynchronous landmark loading races.

The former Tirana/Racing renderers are preserved byte-for-byte as
`cityBaseRenderer.ts` and `baseTiranaScenery.ts`. BlackWater's `baseCityWorld.ts`
retains the original assembler with an explicit excluded-building-ID parameter. Small public
entry-point wrappers compose the new shared landmark layer without changing
input, networking, missions, weapons, race rules or camera directions. The
compatibility adapter retires the old special landmark meshes, prunes verified
museum/tower footprint triangles from merged scenery, and skips replaced
BlackWater building archetypes before batching by ID, not by proximity. Retired meshes remain owned by their
original scene for disposal; BlackWater and Tirana explicitly detach/dispose the
new layer on teardown. Racing's existing group teardown owns its layer.

`cityVisuals.ts` excludes replacement landmark IDs from generic instanced facades
so asynchronous city-asset loading cannot draw another building over them.

## Placement and accuracy

`nativeLocations.mjs` is the single shared registry. It retains the map builder's
projection (origin latitude 41.3275, longitude 19.8188). Clock, mosque and Pyramid
use their existing OSM-derived `WORLD.landmarks` anchors and way IDs. The statue
uses the mapped artwork node 13137823114. Museum and Eyes use sourced building/site
coordinates. BlackWater applies its imported `ORIGIN` once; no scale or axis swap
is introduced. Racing includes landmarks within its existing track-district margin.

These are source/map positions, not survey-accurate registrations. Eyes currently
uses a mapped SITE centre; its exact tower base still needs an in-game alignment
review. Dimensions, facade details and yaw are artist approximations, not surveyed
measurements. The museum relief is an original abstract panel, not a reproduction
of the copyrighted mosaic. Et’hem Bey Mosque is not the separately listed Great
Mosque. The new statue is Skanderbeg, not a substitute labelled as Stalin, Partisan
Girl or Freedom/Victory.

Footprint replacement requires an exact OSM way, an unambiguous nearby name match,
or an unnamed footprint containing the source point. A differently named neighbour
is never removed. If identification fails, the sourced landmark is still placed,
the existing shell is retained, and a diagnostic is exposed in
`scene.userData.tiranaLandmarks` (Racing: `group.userData.tiranaLandmarks`). Check
these diagnostics and any remaining overlaps in the actual full game before merge.

Gameplay colliders are unchanged. The new statue is scenery-only in this pass;
its plinth is NOT a new authoritative collision obstacle. Existing building
colliders remain the shared simulation's original footprints/archetype data and
must be reviewed against the recreated silhouettes before a production release.
No distant/out-of-map monument is moved into central Tirana.

## Original catalogue status

All eleven third-party catalogue entries remain unacquired/unapproved. The old
`APPROVED_TIRANA_LANDMARK_ASSETS` list intentionally tracks only that external
intake and stays empty. The native recreation registry is separate and nonempty.
Petrelë Castle and the unverified statue listings are not added. This is not a
complete recreation of the city or the original catalogue.

## Reproduce checks and GLBs

From repository root on Node 22:

```sh
node --experimental-strip-types --test test/tiranaLandmarkPlacement.test.mjs test/tiranaNativeLandmarks.test.mjs
node webapp/scripts/export-tirana-landmarks.mjs /tmp/tirana-landmark-glbs
```

Executed in this session: **53 tests passed, 0 failed**. Numeric tests cover every
near/far model, finite/nondegenerate geometry, unit normals, orientation consistency,
GLB embedded buffers/accessors, deterministic builds, smaller LODs, geospatial
transforms, BlackWater translation, duplicate and invalid input handling, footprint
identity and conservative triangle pruning. Geographic fixtures are explicitly
synthetic; these tests are not a full-map visual registration test.

All 12 exported GLBs were independently parsed with Python trimesh. Six 390×844
CPU z-buffer review images were rendered from those exported GLBs and inspected.
They are offline model renders, NOT Three.js or actual-game screenshots.
TypeScript transpilation/syntax checks passed for the new/changed local TS files;
this is not dependency-aware typechecking or a full webapp build.

**Not completed:** full application build, actual Three.js/gameplay/browser GPU
verification, multiplayer/collision regression, physical iOS/Android performance,
thermal and touch checks. The local runtime cannot download dependencies; Chromium
also blocked local URLs and could not create a WebGL context for an in-memory
fixture. Do not describe those blocked checks as passed. GitHub Actions had no
reported run when checked; the committed workflow is future reproducible validation,
not evidence of a successful CI run. This branch is for review, not production.

## Reference provenance

Geography retains © OpenStreetMap contributors / ODbL attribution. The registry
contains exact coordinate-source URLs and distinguishes existing map anchors,
mapped building centre, site centre, and statue node. Architectural references:

- Clock: https://www.openstreetmap.org/way/233519333
- Et’hem Bey: https://www.openstreetmap.org/way/175108083
- Pyramid footprint: https://www.openstreetmap.org/way/174510408
- Pyramid transformation: https://www.mvrdv.com/projects/312/the-pyramid-of-tirana
- Museum coordinate: https://mapcarta.com/35570648
- Museum description: https://tirana.al/en/points-of-interest/museums/national-historical-museum
- Eyes site: https://mapcarta.com/W764634562
- Eyes author submission: https://www.theplan.it/award-2025-large/eyes-of-tirana-tower-sculptural-landmark-with-iridescent-facade-and-sustainable-design-in-albanias-capital-xplan-studio
- Skanderbeg: https://www.openstreetmap.org/node/13137823114 and https://mapcarta.com/N13137823114

No third-party reference images, map imagery, proprietary meshes or font files are
embedded in the runtime assets. Inspected base commit:
`d7488a41623f4e9840b008e554e28f8ef6eb6b74`.
