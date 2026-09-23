# Tirana urban update: references and accuracy

Verified 23 September 2026. References guide original game geometry and browser rendering; they are not copied models, photographs, or surveyed measurements.

## Urban monuments

| Place | Verified reference | Implementation boundary |
| --- | --- | --- |
| Skanderbeg Monument and square | [Albanian National Tourism Agency](https://akt.gov.al/en/skanderbeg-monument-and-square/) confirms the 1968 monument, approximately 11 m overall height, pedestrian paving, fountains, and planted areas. | Preserve the existing equestrian monument and its mapped anchor; do not add a second statue or confuse it with the face-shaped Skanderbeg Building. |
| Sulejman Pasha statue | [Municipality of Tirana](https://tirana.al/pika-interesi/shtatorja-e-sulejman-pashes) identifies Maksim Shurdhi's statue, installed in 2000 in Sulejman Pasha Square near the Unknown Partisan. [OSM-derived map](https://mapcarta.com/N6442256741) identifies node 6442256741 at approximately 41.32832, 19.82165. | Map coordinates are approximate. Statue proportions and orientation remain an original artistic reconstruction. |
| Unknown Partisan monument | [Municipality of Tirana](https://tirana.al/pika-interesi/monumenti-i-partizanit-te-panjohur) identifies Andrea Mano's 1949 bronze memorial in Sulejman Pasha Square. [OSM-derived map](https://mapcarta.com/N3006044550) identifies node 3006044550 at approximately 41.3282, 19.82191. | Keep distinct from the neighboring Sulejman Pasha statue; use bronze material and a dedicated plinth. |
| Mother Teresa Square | [Albanian National Tourism Agency](https://akt.gov.al/en/atraksionet/sheshi-nene-tereza/) identifies the public square. | This reference does not establish a Mother Teresa statue in the square. Do not invent a statue there from the square's name. |

Urban map clipping is a gameplay boundary chosen to retain central urban neighborhoods and remove peripheral rural exploration. It is not an administrative boundary. Existing OpenStreetMap attribution and ODbL provenance continue to apply.

Appearance was also checked against Yastay's March 2026 original photographs of [Sulejman Pasha](https://commons.wikimedia.org/wiki/File:Suleim%C3%A1n_Pasha_(S%C3%BCleyman_Pa%C5%9Fa)_01.jpg) and the [Unknown Partisan](https://commons.wikimedia.org/wiki/File:Monumento_al_Soldado_Desconocido_en_Tirana,_Albania_01.jpg). The former is an upright robed figure with a fez, scroll and sash on a low planted base; the latter is a forward-striding figure with raised arm on a tall pale stone plinth. Photographs are research references only, not shipped game textures.

Mission staging uses the same world origin as the street map, not the former arena's local coordinates. [Air Albania's municipal entry](https://tirana.al/pika-interesi/stadiumi-kombetar-qemal-stafa) places it at Sheshi Italia; its [OSM stadium footprint](https://mapcarta.com/W174746492) is centered near 41.3184, 19.8239 (world x 426, z 1013). The [municipal New Bazaar entry](https://tirana.al/pika-interesi/pazari-i-ri) and [OSM marketplace footprint](https://mapcarta.com/W480510821) locate Pazari i Ri near 41.33025, 19.82458 (world x 483, z -306). Combat and extraction positions are fictional, collision-checked points near these sites, not real security arrangements.

## Browser graphics

These official Three.js references are pinned to r164, matching the application's engine generation:

- [Color management](https://raw.githubusercontent.com/mrdoob/three.js/r164/docs/manual/en/introduction/Color-management.html): color and emissive maps use sRGB; roughness, normal, and other data maps generally use `NoColorSpace`. Display output requires the correct sRGB conversion. Increasing lights cannot repair incorrect color-space assignments.
- [Shadows](https://raw.githubusercontent.com/mrdoob/three.js/r164/manual/en/shadows.html): shadow-casting lights add render work; point-light shadows require six views. Restricting the shadow camera to the useful nearby area improves the detail available from a modest shadow texture.
- [InstancedMesh](https://raw.githubusercontent.com/mrdoob/three.js/r164/docs/api/en/objects/InstancedMesh.html): repeated geometry and material can share draw calls; spatially bounded batches retain useful culling.
- [WebGLRenderer](https://raw.githubusercontent.com/mrdoob/three.js/r164/docs/api/en/renderers/WebGLRenderer.html): `compileAsync` can prepare shaders through `KHR_parallel_shader_compile` after lighting/environment configuration. Renderer statistics are useful diagnostics, not proof of a device's frame rate.
- [MeshPhysicalMaterial](https://raw.githubusercontent.com/mrdoob/three.js/r164/docs/api/en/materials/MeshPhysicalMaterial.html): advanced physical features add per-pixel cost. Apply material improvements selectively rather than increasing every object's shader complexity.

## DLSS scope

[NVIDIA's DLSS page](https://www.nvidia.com/en-us/geforce/technologies/dlss/) describes DLSS 5 neural rendering on GeForce RTX 50-series hardware. Its [developer integration page](https://developer.nvidia.com/rtx/dlss) routes developers to Streamline and native game-engine integrations. The [official Streamline repository](https://github.com/NVIDIA-RTX/Streamline) documents native graphics APIs, platform prerequisites, and binary libraries.

Those documented integrations are not a supported drop-in for this mobile Three.js/WebGL application. Browser-native adaptive resolution, material correction, lighting, culling, and animation improvements must not be labeled DLSS or presented as equivalent to neural rendering. Any speed or visual-quality claim needs actual device measurements and gameplay review.
