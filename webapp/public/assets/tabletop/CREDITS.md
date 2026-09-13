# Tabletop collection assets

- `tabletop-pieces.glb`: original TonPlaygram pieces authored and exported in Blender 4.2.0. Six shared meshes: tile, token, house, tower, gem and train. No external model dependencies or textures.
- Editable source: `assets-source/tabletop/tabletop-pieces.blend` (repository root).
- Rebuild: `blender --background --threads 2 --python webapp/scripts/blender/build_tabletop_assets.py` from the repository root.
- Catalog marks: original typographic SVGs created for these games.
- Room geometry reuses `webapp/src/utils/dominoArena.js`, including its table, chairs, cloth and studio lights. No duplicated arena assets.
- Royal Club HDRI reuses `assets/royal-lanes/textures/billiard-hall-1k.hdr` unchanged. Dancing Hall and Colorful Studio reuse the bundled Table Tennis HDRIs unchanged; see `assets/table-tennis/CREDITS.md` for their Poly Haven CC0 attribution.
- Audio reuses `assets/sounds/pounding-cards-on-table-99355.mp3` and the application's existing mute/volume preferences.
- The inline preview embeds the same piece meshes and a 64 × 32 reduced copy of the club environment; it contains no online transport or account calls.
