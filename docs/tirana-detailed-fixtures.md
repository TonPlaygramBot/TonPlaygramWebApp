# Original glTF urban fixtures

The real `UrbanDetailLayer` now loads a 465 KB local GLB containing 16 original fixture modules. It preserves existing roof/facade placements, building exclusions, 35-building normal and 12-building battery selection, and 120-instance capacity per material batch. This shared layer serves both city and racing consumers.

The authored kit adds air-conditioner guard rings and fan vanes, service piping, ribbed water tanks, solar-collector frames, vent grilles, window crossbars and balcony mounting details. It is a recreation extending existing project source, not a recovered workshop asset pack. The geometry is original CC0 with no third-party images or brand assets. It is an incremental detail improvement, not a photogrammetric reconstruction or a console-quality claim.

Loading starts only when fixtures enter view. The previous geometry stays visible while loading and remains available on failure. A complete valid set replaces it atomically, retaining all geometry attributes/material groups. Asset completion resets the update throttle, and late results after teardown are released. Instances share geometry/materials; no new per-instance textures or dynamic shadows are added.

`assets-source/tirana-detail-kit/build.mjs` is the editable authoring source. Rebuild with `node assets-source/tirana-detail-kit/build.mjs`. `webapp/public/assets/tirana-streets/detail-kit/manifest.json` records the output hash and size.

Checks: `node --test test/tiranaDetailKit.test.mjs test/tiranaDetailedFixtures.test.mjs` covers placement and quality budgets, actual GLB parsing and embedded geometry, atomic replacement, failure fallback, late-response disposal and instance bounds. The production runtime entry also bundles with esbuild. These checks are not a full application build or phone FPS benchmark.

Blender 4.3.2 imported and rendered the exported GLB for an asset-only visual check (air conditioner, water tank, solar collector, vent bank and window). This verifies model appearance separately from the game, not in-world placement or mobile GPU performance.
