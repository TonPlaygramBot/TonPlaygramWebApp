# Showood 7 ft table

`showood-4k.glb` is the committed, same-origin runtime asset (1,569,872 bytes,
down from 5,337,228 bytes). The optimizer removes the hidden 42,010-vertex
diamonds mesh and the embedded cloth texture that the selected finish replaces.
Geometry and UV buffers for the remaining meshes are preserved. Embedded wood
and pocket images are recompressed without upscaling; selected surface textures
use the game's 4K profile, with smaller profiles for lower graphics settings.

Source: [Pooltool Showood model](https://github.com/ekiefl/pooltool/tree/da37d9a4cc507c9dba59ffbf3dc4ec77f57c5d55/pooltool/models/table/seven_foot_showood).
Rebuild from the pinned source with `npm --prefix webapp run fetch:pool-royale-showood-table`.
The downloaded original is ignored. `asset-report.json` records sizes and hashes.

The game measures the source cushion noses, six slate cutouts, and pocket-jaw
triangle slices, then applies one uniform scale. Ball diameter is 57.15 mm at
that scale. Cloth height, ball center, floor and player height share the same
coordinates. The procedural table is a playable loading/error fallback.
