# Tirana urban expansion and driver view

This update expands the mapped urban area. It is **not** a completed photorealistic digital twin of every building in the municipality.

## Included

- 35 OSM API tiles, 580,579 source records, acquired with URL/timestamp/SHA-256 receipts. Envelope: 19.752–19.878 E, 41.285–41.375 N. Includes Kombinat, Astir, Lapraka, Kinostudio, Ali Demi, lake and Sauk; 62 mapped neighborhood/suburb/quarter labels.
- 44,543 regional building footprints, plus 1,377 retained central buildings: **45,920 total**. 127,144 rendered road segments; 69,236 connected vehicle graph nodes. The central geometry is retained.
- Courtyard holes, one-way source directions and proven source-node joins remain intact. Six park surfaces are cut around mapped water. Identical footprint/height duplicate audit found zero duplicates; this is not a claim that every possible overlapping volume has been resolved.
- Geometry for buildings and roads is created and evicted in nearby 240 m cells. Cycling/tree placement and sight checks use spatial candidate indexes. The existing layout import fell from roughly 90 seconds to 15 seconds on this development machine; this is not a phone FPS measurement.
- 552 date/typology-selected apartment footprints receive the existing aged-plaster/brick layer, 3,293 rooftop tanks total, and window/AC details. Buildings with unknown dates are explicitly estimated, not certified communist-era buildings.
- Independent plaster base/normal/roughness loading for regional walls. Normal and roughness images stay in linear color space. Roads share tiled asphalt PBR maps. Original vehicle textures are retained.
- A new Blender-authored driver cabin, grained upholstery baked in Blender, and a mapped park-bench asset. Driver eye sockets use each of the ten original collection cars' existing seat measurements; other closed vehicles use a class fit. Active cabin rendering hides that viewer's opaque exterior only for the draw. The camera moves with the seat, with portrait FOV and a close near plane.
- Ambulance injury dispatch, graph routing, visible/nearby patient assistance and return/cooldown. Police service dispatch is tied to wanted state. Pedestrian/vehicle clearance limits service and traffic speed. Police/army squads investigate the last seen position, remain seated while their vehicle moves, and separate overlapping officers deterministically. Force pose changes blend, and gait playback follows measured movement.
- WebGL initialization retries without antialiasing/high-performance preference before existing unsupported-device behavior. Browser policy cannot be overridden by application code.
- Existing saved traffic graph indices are rebound when the source snapshot changes. Lake shore collision uses mapped polygon holes and permits mapped bridges.

## Accuracy limits and remaining work

40,608 regional buildings have neither a sourced height nor level count and retain the explicitly labeled one-storey massing estimate. Facade photographs, roof surveys and construction dates are still needed for individual reconstruction. The 104 mapped memorial/monument/artwork records are retained in the audit; no unsupported bust likenesses have been invented. Terrain still uses the existing flat gameplay datum, and bridge/tunnel grades are not surveyed. This envelope is not the full rural municipality.

The new cabin is a generic authored interior fitted to seat sockets, **not ten individually scanned OEM interiors**. Supplied force rigs still provide Idle/Walk clips; blending and motion pacing do not replace a complete motion-capture/IK animation set. Schools, kindergartens and modern buildings do not yet all have independently researched facade models. Municipality category pages alone do not supply that complete geometry inventory.

## Source and authoring trail

- [Bashkia Tiranë](https://tirana.al/) and [administrative units](https://tirana.al/njesite-administrative): municipal context and official unit information.
- [Municipal architecture overview](https://tirana.al/faqe/trashegimia-dhe-shnderrimi-arkitekturor-ne-tirane) and [school/community listings](https://tirana.al/pikat-e-interesit/shkolla-qender-komunitare): research starting points, not facade measurements.
- [OpenStreetMap license](https://www.openstreetmap.org/copyright): source geometry © OpenStreetMap contributors, ODbL 1.0. Exact request receipts are in the checksummed `assets-source/tirana-urban/source.osm.json.gz.*` parts (concatenate numeric parts to recover the exact original gzip).
- `coverage-audit.json` lists neighborhoods, source-linked monuments, missing-height count and overlap decisions.
- `build-tirana-realism.py` creates the cabin and bench in Blender 4.5.3. Both compressed `.blend` sources include packed textures; runtime GLBs contain embedded textures. Original project geometry, metre units. `manifest.json` records GLB hashes.
- `driver-preview.png` is a Blender render of the authored cabin. It is **not a screenshot of the running game**.

Generated runtime data uses gzip/base64 modules and a tree-shaken MIT-licensed fflate 0.8.2 decoder, keeping the synchronous browser/server import and avoiding a multi-million-node JavaScript AST. Frozen acquisition parts are checked individually and as a concatenated archive by `sourceArchive.mjs`.

Rebuild source with `python webapp/scripts/fetch-tirana-urban.py` followed by `node webapp/scripts/build-tirana-neighbourhood.mjs --urban`. Rebuild models with `blender -b --python webapp/scripts/build-tirana-realism.py`. Source acquisition refreshes the frozen dataset and should be reviewed before committing new counts/hashes.

The React review entry is `webapp/tirana-realism-review.html`; it uses the production StreetRenderer, simulation and assets, and provides neighborhood travel, vehicle selection, look and driving controls.

## Verification

The production Vite build passes under its existing 3 GB heap limit after compressing the generated data; the build still reports large output chunks. The six new driver/dispatch/occlusion/park/encoding tests pass. Existing source, courtyard, squad movement and nearby geometry/disposal checks were exercised. The shared layer test built/decoded 190,879 vertices with 44 visible instances and passed disposal checks.

Browser review reached the real React entry, but this cloud browser returned `Error creating WebGL context`. Its GPU settings page was blocked by browser policy. GPU shader compilation, gameplay screenshots and physical-phone FPS remain unverified; the PR must stay draft until those checks are completed. Separate pre-existing catalog assertions still expect 11 karts while the current catalog contains 20.
