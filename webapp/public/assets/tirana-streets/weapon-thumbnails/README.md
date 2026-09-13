# Weapon picker thumbnails

Generated from the game's shipped weapon geometry, using the same model resolver as the player rig. `sources.json` maps every image to its source model. Original creator credits and licenses remain in the adjacent `living/` and `imported/` asset directories; these previews do not replace or relicense those models.

Reproduce from the repository root with `node scripts/generate-tirana-weapon-thumbnails.mjs` after installing webapp dependencies and preparing the existing weapon assets. Images are 256 × 144 WebP, shown at thumbnail size, with no runtime 3D renderer.
