# Tirana Streets — asset sources

Tirana Streets is an original city sandbox. No Grand Theft Auto code, characters, branding, map or assets are used.

| Asset | Author / primary source | License | Files |
| --- | --- | --- | --- |
| Street network, building footprints, water and parks | [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | `map.svg`, `game/shared/world.mjs` |
| Sedan, sports sedan, taxi, patrol car | [Kenney Car Kit](https://kenney.nl/assets/car-kit) | CC0 1.0 | `sedan.glb`, `sedan-sports.glb`, `taxi.glb`, `police.glb`, `Textures/colormap.png` |
| Animated character | [Kenney Mini Characters](https://kenney.nl/assets/mini-characters) | CC0 1.0 | `character.glb` |
| Textured city facade modules | [Quaternius Downtown City MegaKit](https://quaternius.com/packs/downtowncitymegakit.html) | CC0 1.0 | `city.glb` |
| Asphalt PBR material | [Poly Haven Asphalt 02](https://polyhaven.com/a/asphalt_02) | CC0 1.0 | `asphalt-diff.jpg`, `asphalt-nor_gl.jpg`, `asphalt-rough.jpg` |
| Barlow Condensed / DM Sans | [Google Fonts](https://fonts.google.com/) | SIL Open Font License | Font styles loaded from Google Fonts |
| Interface icons | [Lucide](https://lucide.dev/license) | ISC | React icon components |

The character, city modules and asphalt material are reused from TonPlaygram's existing Tennis Royal / Kart Royale asset pipeline. The Kenney Car Kit was downloaded from the author's own download link. Cars retain the author's shared palette texture and geometry; renderer scaling and material response adapt them to meters and sunset lighting.

The GLB city asset contains two Quaternius buildings and their simplified meshes with embedded PBR maps, as previously prepared for Kart Royale. Repeated city details use GPU instancing. Most background building shells follow OSM footprints with authored facade details and inferred heights where map height tags are missing.

The Pyramid, Clock Tower, mosque and civic square meshes are original artistic reconstructions. The Pyramid's stepped exterior and colorful pavilion concept was referenced against [MVRDV's completed project](https://www.mvrdv.com/projects/312/the-pyramid-of-tirana). No architect photographs are redistributed. Facades, heights, road widths, traffic and missions are approximations for gameplay. This is a bounded central district, not a surveyed digital twin of the whole city.

Engine sound and mission cues are synthesized by the game; no sampled music or commercial game audio is included.

See `DATA-LICENSE.md`, the adjacent author license files and `sources.json` for provenance and checksums. CC0 terms: https://creativecommons.org/publicdomain/zero/1.0/

## Living city upgrade

See [living/ATTRIBUTION.md](living/ATTRIBUTION.md) for the current human, car, firearms, motorcycle, substitutions and individual licenses. The current human is a Mixamo game-use asset, not CC0.
# City completion, September 2026

The models in `completion/city-completion-kit.glb` and
`neighbourhood/completion-*.glb` are original Blender-authored project assets.
Building footprints/levels and mapped fixture locations derive from
© OpenStreetMap contributors (ODbL-1.0). Unmeasured facade designs, tree sizes,
sign mounting offsets and parking layouts are authored approximations.
Native Blender sources, source checksums, per-building asset hashes and the
coverage/omissions report are in `assets-source/tirana-city-completion`.
See `docs/tirana-city-completion.md` for evidence and validation limits.
No Google Street View, Google Earth or ASIG image textures are shipped.
