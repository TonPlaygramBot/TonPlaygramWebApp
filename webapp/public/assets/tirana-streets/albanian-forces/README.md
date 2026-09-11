# Albanian Forces in Tirana Streets

Runtime derivatives of the user-supplied **Albanian-Forces-Asset-Pack.zip**,
revision 2: eight vehicles and six uniformed characters.

`glb/` contains self-contained PBR models. `thumbnails/` contains the supplied
renders. `manifest.json` records the shipped hashes, sizes and triangle counts,
plus original hashes and counts. `PACK-README.md` is the original pack README;
its Blender/rebuild folders are available in the original ZIP, not this runtime
directory. This directory is not the full editable authoring pack.

The game derivatives retain the pack's metre scale, wheel/steering pivots,
materials, skins, joints and Idle/Walk clips. Geometry was simplified with the
existing `optimize-tirana-glb.mjs` pipeline (locked boundaries). Textures larger
than 1024 pixels were resized, preserving their channels. All 14 exports passed
Khronos glTF Validator with zero errors after these changes.

Total: 668,883 triangles and 48,161,160 bytes, down from 1,524,661 triangles and
73,560,264 bytes. These are the shipped source totals, not per-frame draw counts.
The game streams at most two files concurrently and displays up to three nearby
vehicles plus three nearby officers (two of each in battery mode). Existing game
actors provide loading, failure and distant fallbacks. Templates share geometry
and textures; character instances have independent skeletons.

## Credits and licenses

Keep [ATTRIBUTION.md](ATTRIBUTION.md), [REFERENCES.md](REFERENCES.md) and all
upstream notices in `notices/` with these derivatives. Licenses are mixed:
CC0, CC BY, CC BY-SA and Apache 2.0, as documented per source. Vehicle derivatives
retain the applicable ShareAlike terms. Geometry simplification and texture
resizing do not change those terms. The game's asset-credits panel links to the
attribution document.

To reproduce, install the webapp's locked dependencies and run from the repo root:

```sh
python webapp/scripts/import-albanian-forces.py /path/to/Albanian-Forces-Asset-Pack.zip
```
