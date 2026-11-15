# Snooker table

Author: MesXwi — https://sketchfab.com/MesXwi

Source recorded in the uploaded GLB: https://sketchfab.com/3d-models/snooker-table-b5930e8c780a4eabaad4e3e9be23ef09

Licence recorded in the uploaded GLB: CC BY-NC 4.0 — https://creativecommons.org/licenses/by-nc/4.0/

Supplied file: `snooker_table(1).glb` (255,951,228 bytes).
The source SHA-256 is embedded in the prepared GLB and `snookerUploadedTableGeometry.json`.

Modifications: retained the 22 table meshes; removed display balls, cues, cue boxes and the suspended lamp; repacked retained accessor values without changing them; resized textures to at most 1024 pixels and re-encoded opaque maps as JPEG. Original materials, UV layout, pocket irons, nets and eight legs are retained. At runtime, the bed is uniformly fitted to the existing game footprint and only the lower leg sections are extended to reach the existing arena floor.

The source's noncommercial licence is retained. This change does not establish additional commercial-use permission.

Native-resolution texture restoration: `4k/` contains the author's original
4096 × 4096 colour, normal and packed roughness/metalness maps for the legs,
leg holders, cushion, baize and pockets. These are encoded as Basis ETC1S KTX2
with 13 mip levels; they are not upscaled from the prepared GLB. The small pin
atlas remains at its original 1024 × 1024 resolution in the GLB. Pocket colour
alpha, material factors and UVs are preserved. Maps are vertically flipped to
match the uploaded GLB's image orientation; roughness is in green and metalness
in blue. The existing 1024-pixel images provide the initial table and remain in
use on GPUs without compatible 4K compressed-texture support.

Source archive SHA-256: `e154c8451814f0e07bd1d89aaf886926b6458ca9cf7f2a8b9616b4dcff1cda5f`.
Reproduction: `python scripts/build-snooker-table-textures.py snooker-table.zip /path/to/basisu`.
The same MesXwi source and CC BY-NC 4.0 attribution above applies to these maps.
