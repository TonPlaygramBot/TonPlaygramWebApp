# OpenStreetMap data and derived geography

© OpenStreetMap contributors. Street coordinates, building footprints, water, parks, and the derived routing graph in `world.mjs` and `map.svg` are made available under the **Open Database License (ODbL) 1.0**:

https://opendatacommons.org/licenses/odbl/1-0/

Download the complete derived dataset: [world.json](./world.json).

The derived geography is available in editable, complete form in the game's `shared/world.mjs` module. It includes its origin, bounds, roads, footprints, landmark positions, routing graph, source URL and SHA-256 of the OSM snapshot. The wrapper is JavaScript; the `WORLD` value is JSON data. The dataset is not encrypted or obfuscated.

Original source: https://api.openstreetmap.org/api/0.6/map?bbox=19.809,41.317,19.827,41.331

Projection: local equirectangular meters around latitude 41.3275, longitude 19.8188, with east as +X and south as +Z. Heights without OSM tags, facade treatments, AI, mission routes and gameplay rules are authored approximations. The playable area is clipped to the bounds stored in `WORLD`.

The generated map SVG is a Produced Work from the database. The derived database remains available under ODbL. The ODbL notice applies to geographic data, separately from CC0 third-party 3D assets and the application code. Keep visible OpenStreetMap attribution on game scenes and maps and provide the license link when redistributing.

OpenStreetMap copyright and attribution guidance: https://www.openstreetmap.org/copyright
