# Tirana Streets / Racing Royal — regional detail upgrade

## What this change actually ships

Shared decorative storefronts are integrated through `WorldEnhancements`, which is already used by the active Tirana Streets FPS/career and Racing Royal Tirana scenery. Four original, fictional businesses have glTF 2.0 frontage modules: Kafe Lana, Furrë Drita, Marketi i Lagjes and Velo Tirana. Each module has 650 triangles, six PBR material batches, an awning, sign frame, balcony rail and slatted AC condenser. This is an architectural detail kit, not a set of complete measured buildings or enterable stores.

The runtime parses real glTF geometry and renders original 2048×512 sign artwork. The exporter creates self-contained `.gltf` files with embedded PNGs, plus 2048×1024 illustrated posters and a standalone React + Three.js viewer. Artwork is original illustration, NOT photography. No Google image pixels, logos, photogrammetry or proprietary meshes are copied. Existing base-city textures are not globally replaced.

Placement follows existing stored footprint edges facing stored roads. Named buildings and explicitly identified civic landmarks are excluded. Unknown/low building heights are excluded. Decorations stay above 2.6 m and do not invent doorways, alter collision or move the source city. Nearby instances are capped at 48, or 16 when Racing Royal forwards its existing performance mode; updates are throttled to 4 Hz. These are configured budgets, not measured phone FPS guarantees. Tirana Streets currently uses the normal cap.

`GREATER TIRANA` adds an independent regional atlas to the shared map used by both games. It covers Kthesa e Kamzës, TEG / Rruga e Elbasanit, both Dajti terminals and the Dajti summit. Existing city routes, favourites, minimap, initial framing and map source are preserved byte-for-byte in `CityMapCore.tsx`. The prior civic/Dajti renderer is preserved byte-for-byte in `BaseWorldEnhancements.ts`. Their original Git blob identities are CI guards.

## Not a continuous playable ring or surveyed city

**The extended atlas is not a continuous walkable/drivable map expansion.** No line is invented between the reference points. Original WORLD, roads, terrain collision, navigation and racing circuits are unchanged. Dajti scenery retains its prior authored, approximate relief. This PR does not add the missing mountain roads, surveyed hills, complete lakes, citywide building reconstruction, or a real outer-ring route. Outside-district directions remain unavailable.

The acquisition envelope is 19.740–19.945° E, 41.270–41.405° N, chosen for source collection, not an administrative boundary. Kthesa e Kamzës uses an OSM bus-stop reference near the requested turn, NOT Kamza town centre or a surveyed interchange point. TEG uses a building-centre reference, NOT its vehicle entrance. Position metadata explicitly records these distinctions.

## Geographic acquisition and review

`regionImport.mjs` validates a complete OSM response before producing a **source-review-only** JSON file. It preserves source node identity, every road segment, direction, bridge/layer/tunnel/access and tagged cycleway metadata. Missing widths/heights remain null. Water multipolygon islands remain holes. Timeout/partial responses, missing nodes, duplicate IDs, open/ambiguous polygons and unbuilt roads cannot silently become playable infrastructure. `runtimeReady` remains false. The bilinear elevation sampler preserves no-data rather than flattening failed terrain to zero.

From the repository root:

```sh
node webapp/scripts/import-tirana-region.mjs --query
node webapp/scripts/import-tirana-region.mjs input.osm.json regional-review.json https://overpass-api.de/api/interpreter 2026-09-08T00:00:00Z
```

The CLI does not download data during the app build, change WORLD or claim source coverage. Supply the actual acquisition timestamp, not the example timestamp above. No full regional OSM response or DEM was successfully acquired in this implementation environment. Real DEM vertical datum, bridge/road elevation alignment, topology connectivity, ring-road coverage and collision integration must be reviewed before promotion into either game.

Reference sources reviewed:

- Kthesa e Kamzës: https://mapcarta.com/N10909820605 (OSM node 10909820605).
- TEG: https://mapcarta.com/W293898197 (OSM way 293898197); https://teg.al/ for the Tirana–Elbasan location.
- Dajti lower/upper terminals: https://mapcarta.com/N1911239826 and https://mapcarta.com/N8956716488 (existing project reference coordinates retained).
- Dajti summit: https://mapy.com/en/?id=6304596&source=osm.
- Ring-route candidate: OSM relation 20772795. Requesting this relation is not verification of current route completeness.
- OSM attribution/license: https://www.openstreetmap.org/copyright and https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL.
- ASIG national geoportal: https://geoportal.asig.gov.al/ — potential terrain/orthophoto source; dataset availability and permitted reuse require review. No ASIG terrain is bundled.
- Google usage guidance: https://about.google/brand-resource-center/products-and-services/geo-guidelines/ . Satellite/Street View/Earth links are external review aids only. No automated Street View survey was completed and no perfect geographic precision is claimed.

## Asset export and Blender

With the webapp's existing `sharp` and development `typescript` dependencies installed:

```sh
cd webapp
node scripts/export-tirana-shopfronts.mjs ../artifacts/tirana-shopfronts 2048
cd ..
blender --background --python tools/blender/tirana_shopfronts.py -- --assets artifacts/tirana-shopfronts --output artifacts/tirana-blender --samples 64
```

The exporter supports 1024, 2048 and 4096 pixel widths; normal runtime signs stay at 2048. Generated `preview.html` embeds the glTF assets but needs Internet access for pinned React 18.2 / Three 0.164 CDN modules. It is an asset showroom, not either live game. The Blender script imports the exported kit, saves scenes and renders a gallery and an original coffee still-life. **Blender was unavailable; this script was syntax-checked only. No `.blend` files or Blender-rendered photographs are claimed.**

## Validation actually executed

- Node 22.16: `node --test test/tiranaRegionalDetails.test.mjs test/tiranaRegionSource.test.mjs` — **22 passed, 0 failed**. Geographic test fixtures are synthetic, not actual surveyed Tirana geometry.
- Six changed TS/TSX modules pass TypeScript transpilation syntax diagnostics, **not dependency-aware typechecking**.
- All four exported glTF files independently parsed with Python trimesh: six geometry groups, 650 triangles each; finite vertices, positive triangle areas. Embedded 2048×512 PNGs decoded with Pillow. Original poster raster output visually inspected.
- Blender authoring Python passes syntax compilation only.

Full app build, actual-game browser interaction, physical-phone GPU/FPS/memory testing, existing map/career regression execution and successful CI are NOT confirmed locally. The added workflow runs real existing/new test entry points and exact-source preservation guards; adding the workflow does not assert it has run. Keep the PR draft until these integration/release checks pass. No merge, production deployment, TPG mutation or paid-multiplayer changes are part of this work.
