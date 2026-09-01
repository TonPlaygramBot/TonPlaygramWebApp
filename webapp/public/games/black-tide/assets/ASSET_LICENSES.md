# Asset licenses

All assets listed in `manifest.json` may be used, modified, and redistributed in
commercial or non-commercial projects under Creative Commons Zero 1.0 (CC0).

## Kenney GLB collections

- Vehicles: **Car Kit 3.1**
- Buildings: **City Kit Commercial 2.1**
- Roads and street props: **City Kit Roads 2.1**
- Weapons and mission props: **Blaster Kit 2.1**

Creator/distributor: [Kenney](https://kenney.nl/). Attribution is appreciated
but is not required. The original license notices are preserved in `licenses/`.

## PMNDRS environment assets

The three EXR environments, cloud texture, and surface normal maps were decoded
from **@pmndrs/assets 1.7.0**, a CC0 asset package maintained by PMNDRS. The
upstream package is available at <https://github.com/pmndrs/assets> and its full
CC0 notice is preserved as `licenses/pmndrs-assets-cc0.txt`.

The normal-map filenames in this project are descriptive aliases based on their
appearance; they correspond to upstream files `0001`, `0003`, `0006`, `0008`,
`0012`, `0015`, `0023`, `0025`, and `0028`, respectively.

## Poly Haven PBR material and HDRI

- **Asphalt 04**: 1K diffuse, OpenGL normal and packed ARM maps.
- **Modern Evening Street**: 1K HDR environment for reflections and lighting.

Both assets are published under CC0 by [Poly Haven](https://polyhaven.com/license).
The source URLs and license record are preserved in
`licenses/poly-haven-cc0.txt`.

## Animated operative

`models/characters/operative.glb` is the official Three.js
**RobotExpressive** sample. The original model by Tomas Laulhe is CC0 and the
glTF conversion/modification is by Don McCurdy. Its record is preserved in
`licenses/robot-expressive-cc0.txt`.

The local copy normalizes all four `WEIGHTS_0` accessors (752 affected vertices)
without changing geometry, animations, or materials, eliminating the glTF
validator's non-normalized skin-weight errors.

## Khronos Toy Car hero vehicle

`models/vehicles/hero-muscle-pbr.glb` is an optimized derivative of the official
[Khronos Toy Car](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ToyCar)
sample. The initial car model is by **Guido Odendahl**; its material extensions
and scene composition are by **Eric Chadwick**. The model is dedicated to the
public under **Creative Commons Zero v1.0 Universal (CC0-1.0)**.

The local derivative preserves the original clearcoat, transmission, sheen, and
texture-transform materials. Its textures are embedded WebP images at no more
than 1024 px, MikkTSpace tangents were added for consistent normal mapping, and
vertex data uses standard `KHR_mesh_quantization`. It has no Draco or Meshopt
runtime decoder dependency. Source URLs, checksums, and the legal record are
preserved in `licenses/khronos-toycar-cc0.txt`.

## External GLB texture dependencies

Kenney's GLB files reference `Textures/colormap.png`. The required CC0 color
atlas is preserved beside each vehicle, building, road, weapon and prop
collection so the models remain self-contained when this folder is deployed.
