# Jet Ski Royal assets

All third-party 3D assets are loaded locally, with their source materials and textures retained.

- `watercraft.glb`: **Personal watercraft**, Innerscene. CC0 1.0. Original file downloaded 2026-11-13 (5,310,508 bytes). https://www.innerscene.com/tools/library/3d-parts/personal-watercraft-1956f692 . https://creativecommons.org/publicdomain/zero/1.0/ . Runtime rotates the model to the game's forward direction, merges rigid meshes by original material, and articulates the original handlebar/grip meshes. Three selectable specifications use this one hull; they are not represented as three unique models.
- `rock/`: **Rock Face 01**, Poly Haven. CC0 1.0. Original 1K glTF, geometry and three source textures. https://polyhaven.com/a/rock_face_01 and https://polyhaven.com/license . Instanced at different scales and orientations to form the coastal scenery.
- `waternormals.jpg`: Three.js r164 examples. Original unchanged. https://github.com/mrdoob/three.js/blob/r164/examples/textures/waternormals.jpg . MIT license: https://github.com/mrdoob/three.js/blob/r164/LICENSE . Copyright 2010–2024 Three.js authors.
- Rider: reuses `/assets/table-tennis/athlete-male.glb`, the repository's bundled **Quaternius Universal Base Characters** male model (CC0). Original credits and license remain in `../table-tennis/CREDITS.md` and `Quaternius-LICENSE.txt`. Wetsuit-like source material is retained; hands/feet and torso use runtime skeletal posing. This is a stylized anatomical character, not a scanned human.
- `cover.webp`: rendered in Blender from the actual CC0 watercraft model, for the Games card. It is cover art, not an in-engine screenshot. Rebuild with `tools/render-jetski-cover.py`.

Course markers, ramps, HUD, wake/spray effects and engine/water/checkpoint audio are original game code. Course names are inspired by Albania's coast; layouts are fictional circuits, not surveyed geographic recreations. No reference-video media or proprietary game assets are distributed.
