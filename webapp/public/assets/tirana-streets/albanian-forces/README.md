# Albanian Forces in Tirana Streets

Original runtime assets from the user-supplied **Albanian-Forces-Asset-Pack.zip**,
revision 2: eight vehicles and six uniformed characters.

`glb/` contains all 14 self-contained PBR models, copied byte-for-byte from the
ZIP. `thumbnails/` contains all 14 supplied thumbnails, also unchanged.
`manifest.json` records shipped and original SHA-256 hashes, sizes and triangle
counts; each shipped value matches its source. `PACK-README.md` is the original
pack README. Editable Blender scenes and rebuild sources remain in the original
ZIP; they are not required by the game and are not served in this runtime folder.

No geometry simplification, texture resizing, recompression, material replacement,
or rig/animation conversion is applied. Embedded textures, metre scale,
wheel/steering pivots, skins, joints and Idle/Walk clips remain intact.
The runtime URLs use `?v=original-v2` to avoid cached reduced models.

Total: 1,524,661 triangles and 73,560,264 bytes across the 14 GLBs. These are pack
totals, not per-frame draw counts. Full-detail assets cost more GPU memory and
bandwidth than the previous reduced manifest. The game streams at most two
files concurrently and displays up to three nearby vehicles plus three nearby
officers (two of each in battery mode). Existing game actors provide loading,
failure and distant fallbacks. Templates share geometry and textures; character
instances have independent skeletons. Physical-phone performance is not verified.

## Credits and licenses

Keep [ATTRIBUTION.md](ATTRIBUTION.md), [REFERENCES.md](REFERENCES.md) and all
upstream notices in `notices/` with these assets. Licenses are mixed:
CC0, CC BY, CC BY-SA and Apache 2.0, as documented per source. Vehicle derivatives
retain the applicable ShareAlike terms. The game's asset-credits panel links to
the attribution document.

To reproduce, run from the repo root with Python (no npm install required):

```sh
python webapp/scripts/import-albanian-forces.py /path/to/Albanian-Forces-Asset-Pack.zip
```

The importer deliberately does not invoke either optimization script.
