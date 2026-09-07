# Kart Royale asset credits

The original kart, city templates and road textures in the first table are **CC0 1.0 Universal**
(public domain dedication), free to use, modify and redistribute commercially.
The Tirana-series flag and geographic data have separate licenses recorded below.
License: https://creativecommons.org/publicdomain/zero/1.0/

| Shipped assets | Creator and original source | Adaptation |
| --- | --- | --- |
| `apex.glb`, `apex-lod.glb` | **scaranto**, Kart — https://poly.pizza/m/fLovOv3TAH | Reoriented and scaled mechanical chassis, engine, seat, cables and steering assembly; replaced tires with smooth profiles; added wheel/steering pivots, PBR finishes, bumper and TonPlaygram's helmeted driver. Two geometry detail levels. |
| `city.glb` | **Quaternius**, Downtown City MegaKit, free Standard edition — https://quaternius.com/packs/downtowncitymegakit.html | `Building_Small_1` and `Building_Medium_2_001`, converted to centered GLB templates with distance LODs. Removed unseen interiors and custom vertex-shader channels, changed glazing to opaque PBR for instancing, compressed shared maps to 512px/1K JPEG. |
| `asphalt-diff.jpg`, `asphalt-nor_gl.jpg`, `asphalt-rough.jpg` | **Rob Tuytel / Poly Haven**, Asphalt 02 — https://polyhaven.com/a/asphalt_02 | 1K diffuse, OpenGL normal and roughness maps recompressed for local delivery. Poly Haven asset license: https://polyhaven.com/license |
| `cover.webp` | TonPlaygram render of the adapted Scaranto kart above | Rendered from the delivered GLB, with a garage backdrop. |

The original Quaternius license is retained in `licenses/quaternius.txt`.
The building source files were obtained from the public, unmodified Standard-edition
selection in https://github.com/AetherRadar/operation-steel-tide/tree/26e8591ac6a95a44c86bb45861d9a21aec3efcb2/assets/models/quaternius_downtown_city .
Only the CC0 source models/textures were used; no code or other assets from that
project were copied. Original names, URLs, source byte sizes, immutable mirror
commit and SHA-256 checksums are in `webapp/scripts/kart-royale-sources.json`.
Sources were verified on 2026-09-06.

The driver's component construction, racing interface, circuits and engine audio
continue to reuse TonPlaygram's existing work. Engine recording:
`/assets/sounds/race-care-151963.mp3` (pre-existing repository asset, unchanged;
its existing license terms still apply). New third-party files above do not
change the licensing of pre-existing TonPlaygram code or audio.

No model, texture CDN or paid asset service is contacted while playing. All
model geometry and textures are shipped in the repository and served locally.

## Racing Royal — Tirana street series (2026-09-07)

- Five new kart assets `kenney-{oobi,oodi,ooli,oopi,oozi}.glb`: **Kenney, Car Kit 3.1**, CC0 1.0. https://kenney.nl/assets/car-kit . Original models are retained byte-for-byte. Runtime adaptations normalize size, animate the wheels, and add distinct front fairing, wide sidepod or rear-wing details. All choices share the same performance. The license is retained in `licenses/kenney-car-kit.txt`; hashes and the download URL are in `tirana-sources.json`.
- `albania.svg`: **lipis/flag-icons contributors**, MIT, version 7.3.2. https://github.com/lipis/flag-icons/blob/v7.3.2/flags/4x3/al.svg . The full license is retained in `licenses/flag-icons.txt`.
- Roads, building footprints, parks, river and landmark coordinates reuse **Tirana Streets' OpenStreetMap snapshot**. © OpenStreetMap contributors, **ODbL 1.0**, https://www.openstreetmap.org/copyright . Editable source: [world.json](../tirana-streets/world.json); selected road centerlines: [tirana-routes.json](./tirana-routes.json). See [DATA-LICENSE.md](../tirana-streets/DATA-LICENSE.md). Heights, facades, landmark meshes and race widening are gameplay approximations, not photogrammetry.
- Human supporters are original instanced geometry. Landmark representations reuse TonPlaygram's existing Tirana Streets constructions.
- Engine, tire skid, airflow, crash, countdown, finish and crowd-clap effects use original Web Audio synthesis. Racing Royal no longer loads the old engine recording.
- The old Quaternius `city.glb` is retained for compatibility with earlier work; Tirana races use the geographic city renderer instead.
