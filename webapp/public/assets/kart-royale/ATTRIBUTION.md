# Kart Royale asset credits

All newly imported third-party models and textures below are **CC0 1.0 Universal**
(public domain dedication), free to use, modify and redistribute commercially.
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
