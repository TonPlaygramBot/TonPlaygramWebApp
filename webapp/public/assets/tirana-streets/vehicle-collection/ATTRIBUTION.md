# Attribution and licences

These are Blender adaptations of licensed, pre-existing detailed vehicle meshes, following the donor-mesh + UV/PBR + GLB technique used in the uploaded Albanian Forces pack. They are not ten meshes sculpted from scratch. Original authors retain their rights. Keep this attribution with redistributed assets.

| Asset | Original author | Licence | Original model | Retrieved source |
|---|---|---|---|---|
| Mercedes-Benz S 65 AMG W221 | supercarmodels | CC BY 4.0 | [Original](https://sketchfab.com/3d-models/2011-mercedes-benz-s-65-amg-w221-8ffa2d947cce478eb0a60cf1a230c592) | [Source](https://github.com/tapader13/car-company-3d/blob/main/public/carThree-transformed.glb) |
| BMW M3 GT3 | Neubi; CryHam (interior/import); Neubi (Ford wheels) | CC0 body/interior; CC BY-SA wheels (version unspecified in upstream notice) | [Original](https://www.blendswap.com/blends/view/19869) | [Source](https://github.com/stuntrally/blendfiles/tree/master/cars/XZ) |
| Range Rover Sport 2018 | diw3d | CC BY 4.0 | [Original](https://sketchfab.com/3d-models/range-rover-sport-2018-d1fe581b3baf4af89275e9aa9a1392e2) | [Source](https://github.com/aditya-bansal-7/Land-Rover-Website-Reimagine) |
| Audi A8 Custom 2018 | everhard | CC BY 4.0 | [Original](https://sketchfab.com/3d-models/audi-a8-custom-2018-cd094d03f7684809900a929a9c88c8db) | [Source](https://github.com/ViktorVelizarov/Custom-Cars-3D/blob/master/public/audiA8.gltf) |
| Ford Focus | Neubi; CryHam (import/settings) | CC BY-SA (version unspecified in upstream notice) | [Original](https://www.blendswap.com/blends/view/15406) | [Source](https://github.com/stuntrally/blendfiles/tree/master/cars/FN) |
| Fiat Punto GT 1995 | Karol Miklas | CC BY 4.0 | [Original](https://sketchfab.com/3d-models/free-1995-fiat-punto-gt-48db6facb4b64e99b60f36b8c01185e1) | [Source](https://github.com/Dziuras98/car-game) |
| Jaguar I-Pace | GT Cars / Car2022 | CC BY 4.0 | [Original](https://sketchfab.com/3d-models/jaguar-i-pace-296a97a6c07041cf9c48f8a303315ed2) | [Source](https://github.com/Sumegh-git/xworld/blob/main/public/assets/world/models/jaguar-ipace.glb) |
| Ferrari 458 Spider | vicent091036 | CC BY 4.0 | [Original](https://sketchfab.com/3d-models/ferrari-458-italia-57bf6cc56931426e87494f554df1dab6) | [Source](https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/ferrari.glb) |
| Bugatti La Voiture Noire 2019 | Ddiaz Design | CC BY 4.0 | [Original](https://sketchfab.com/3d-models/2019-bugatti-la-voiture-noire-5a4f0bad5ecb4fccafa2ea36f9bfaeea) | [Source](https://github.com/jules-sys/bugatti-3d-model) |
| Land Rover Defender Grasmere | PROJECT CAR90 / Samuel Carvalho | CC BY 4.0 | [Original](https://sketchfab.com/3d-models/land-rover-defender-edition-grasmere-green-b7596dc0abc749c3b076d1f830715a54) | [Source](https://github.com/aditya-bansal-7/Land-Rover-Website-Reimagine) |

CC BY 4.0: https://creativecommons.org/licenses/by/4.0/

CC0: https://creativecommons.org/publicdomain/zero/1.0/

For Ford and the BMW wheel meshes, the supplied Stunt Rally notice states CC BY-SA without a version. That original notice is preserved in [licenses/ford.txt](licenses/ford.txt). Preserve the same ShareAlike terms; this collection does not relicense those parts as CC0 or CC BY. BMW body/interior and the Ford wheel meshes retain separate source terms. The [BMW](licenses/bmw.txt), [Ferrari](licenses/ferrari.txt) and [Bugatti](licenses/bugatti.txt) upstream notices are also preserved here.

## Poly Haven textures and lighting

- Brown Leather, Rob Tuytel — CC0 — https://polyhaven.com/a/brown_leather
- Studio Small 09 HDRI, Sergej Majboroda — CC0 — https://polyhaven.com/a/studio_small_09

The Poly Haven files were reused from the uploaded pack, including its existing JPG texture conversions. Leather normal/roughness maps are applied to isolated upholstery materials where available, otherwise to added interior upholstery inserts. Authored vehicle texture atlases are retained. The studio HDRI is packed into Blender scenes and is separate from the vehicle-only GLB.

## Modifications

Prepared in Blender 4.2.9 LTS. Cleaned transforms and stale source animation, aligned vehicle noses to +X with Z up, centered models on the ground, approximated metre scale, reconstructed Ford/BMW wheel placements, adjusted selected paint/glass/chrome materials, retained source UVs, added Poly Haven upholstery, consolidated static meshes by material, and exported embedded-texture Draco GLB. Removed two disconnected duplicate Defender parts and the Fiat's baked shadow plane. Created studio cameras, floor, lights, and renders.

Ferrari source is titled “Ferrari 458 Italia”; this supplied mesh has an open roof and is labelled “458 Spider” in the collection. Brand/model names identify the depicted vehicles; this is not an official manufacturer asset collection.

Original preview and pipeline code written for this collection may be used and modified with the collection. Included third-party software retains its own notices (Three.js/Draco/UI dependencies).

## In-game NPC drivers

Drivers reuse the existing `/assets/table-tennis/chess-human.glb` Ready Player Me human from Chess/Table Tennis. Its existing permission and attribution remain in force; it is not CC0. No driver binary has been added to the vehicle collection. Vehicle GLBs are byte-for-byte copies of the approved Ten-Car-Collection; driver rigging is applied separately at runtime.
