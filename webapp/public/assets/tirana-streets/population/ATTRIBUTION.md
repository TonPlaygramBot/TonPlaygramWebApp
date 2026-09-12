# Tirana city population assets

`tirana-articulated-bus.glb` is original geometry authored in Blender 4.2 with `webapp/scripts/blender/build_tirana_population.py`. It is 18 m long and 2.55 m wide, with three axles, an articulated rear section, door leaves, seats, handrails, mirrors, destination signage and a driver cabin. Units are metres; glTF forward is -Z and up is +Y.

The municipal green livery and articulated silhouette were informed by these visual references:

- https://greentirana.com/bus/ — Tirana green hybrid fleet.
- https://busphoto.eu/photo/715218/ — Solaris Urbino III 18 Hybrid in Tirana.
- https://fotobus.msk.ru/photo/3720278/ — Mercedes-Benz Citaro G in Tirana.
- https://fotobus.me/photo/3723391/ — articulated Kombinat–Kinostudio service.

No source photographs, logos, textures or third-party bus meshes are bundled. The model is an original game approximation, not an exact manufacturer replica. The plate is fictional. Route names are scenery; buses follow the game's road graph rather than real timetables.

`citizen-0.glb` through `citizen-7.glb` are Blender derivatives of the repository's existing `webapp/public/assets/table-tennis/chess-human.glb`. They retain its rig, textured facial features and UVs, with eight combinations of head proportions, facial hair and clothing palettes. Runtime body proportions add further variation. They are variants of one source avatar, not eight independent scans.

Original human source: https://threejs.org/examples/models/gltf/readyplayer.me.glb

Creator/platform: Ready Player Me. These models are not CC0. The original metadata and existing project permissions apply to these derivatives; see `webapp/public/assets/table-tennis/CREDITS.md`. This change grants no additional licence.

Bus occupants use lightweight seated meshes with varied skin tones, head proportions and clothing to bound mobile rendering cost. Nearby street NPCs use the eight rigged assets above.
