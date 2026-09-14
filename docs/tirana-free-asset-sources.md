# Tirana Streets: verified asset and landmark sources

Checked 14 September 2026. This records source provenance and practical limits;
the runtime manifests and imports determine which assets actually ship.

## Acquired CC0 surface materials

Both sets are authored by **Rob Tuytel / Poly Haven** and licensed
[CC0](https://polyhaven.com/license), including modification, redistribution,
and commercial use. Each downloaded map is 1024 × 1024 pixels. They are surface
materials, not photographs of the Tirana buildings or exact square paving.

| Material | Source | Physical repeat | Suitable detail |
| --- | --- | --- | --- |
| Pavement 01 | https://polyhaven.com/a/pavement_01 | 1.5 m | Worn stone paving at street edges and courtyards |
| Concrete Floor 02 | https://polyhaven.com/a/concrete_floor_02 | 2 m | Subtle mineral pitting and roughness on concrete |

Official download pattern, with `ASSET` and `MAP` replaced by the values above
and `diff`, `nor_gl`, or `arm`:

`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/ASSET/ASSET_MAP_1k.jpg`

Diffuse maps use sRGB. OpenGL normal and packed ARM maps are linear data.
ARM channels are red = ambient occlusion, green = roughness, blue = metalness.
For clean new buildings, use mineral normal/roughness sparingly and preserve
the landmark's original facade color. Avoid tiled brick patterns on the
square's large, multicolored stone slabs.

| Downloaded file | SHA-256 |
| --- | --- |
| pavement_01_diff_1k.jpg | 5555990f88822fe44eb44a67f5abda2c9425c143aad72962a826fcad53954318 |
| pavement_01_nor_gl_1k.jpg | 5c6210015db8aad8b9e417228f4ccba6d1c7bb7322058c1a9699609101dabc38 |
| pavement_01_arm_1k.jpg | bd39a34436c3e9fd94a4b16e7f1516290f0982f153e56728c5f014e1e601cfb0 |
| concrete_floor_02_diff_1k.jpg | 6db84a6d87dc50508b9d134d6fbd2b7e876b8081a5f43a118a249ca18de73af5 |
| concrete_floor_02_nor_gl_1k.jpg | fcda391b57a816d646ae15544688be53790478da5cd48dbe514b3c6901415e61 |
| concrete_floor_02_arm_1k.jpg | 01d80e4cb4eb4605902d1c1362da1c309fdba5907039acddd9226d893bbd8946 |

## Free animation source

[Quaternius Universal Animation Library](https://quaternius.itch.io/universal-animation-library)
offers a free **Standard** subset under CC0. The advertised 120+ animations
describe the entire library, including paid Pro/Source additions; the complete
pack must not be described as a free acquisition. The author's
[OpenGameArt listing](https://opengameart.org/content/universal-animation-library)
independently identifies the Standard subset and its CC0 license.

The current v3 release, dated 16 June 2026, includes both root-motion and
in-place versions and fixes the phase alignment of directional footsteps.
Retargeting must respect each destination rig's rest pose and bind axes.
Keep the original RENEA, FNSH, and Shqiponja meshes and uniform textures;
an animation source is not a replacement character model.

The Standard v3 archive was acquired through the author's normal free
download flow on itch.io. Its included `License.txt` confirms CC0 1.0
Universal. It contains **43 actual clip entries** in each GLB; the older
OpenGameArt page's count of 45 is not used as the inventory for this release.

| Source file | Bytes | SHA-256 |
| --- | --- | --- |
| Universal Animation Library[Standard].zip, v3 | 15,904,933 | cc73fc4e495b82958207316596317a3f40b9fa38065bde1027937452da537724 |
| Unreal-Godot/UAL1_Standard.glb | 7,618,436 | 69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997 |
| Unreal-Godot/UAL1_Standard_RM.glb | 7,620,504 | be684571ed655a1b892c2c07e6e2aeca053b606c442d34004adaf1d944090d01 |

The archive also provides two FBX exports, setup images, and a README. Prefer
the in-place GLB for extracting normalized pose/gait curves when game physics
already owns character translation. `_RM` deliberately adds authored root
motion. Source rig joints include `pelvis`, `spine_01` through `spine_03`,
`clavicle_l/r`, `upperarm_l/r`, `lowerarm_l/r`, `hand_l/r`, `thigh_l/r`,
`calf_l/r`, `foot_l/r` and `ball_l/r`.

| Motion | Exact useful clip names in the acquired Standard release |
| --- | --- |
| Locomotion | Walk_Loop, Walk_Formal_Loop, Jog_Fwd_Loop, Sprint_Loop, Crouch_Fwd_Loop, Crouch_Idle_Loop |
| Combat | Pistol_Aim_Down, Pistol_Aim_Neutral, Pistol_Aim_Up, Pistol_Idle_Loop, Pistol_Reload, Pistol_Shoot, Punch_Cross, Punch_Jab |
| Reactions | Hit_Chest, Hit_Head, Death01, Roll |
| Jumping | Jump_Start, Jump_Loop, Jump_Land |
| Street life | Idle_Loop, Idle_Talking_Loop, Driving_Loop, Interact, Fixing_Kneeling, PickUp_Table, Push_Loop, Sitting_Enter, Sitting_Exit, Sitting_Idle_Loop, Sitting_Talking_Loop |

## Architectural references

These are factual design references. Their photographs, renders, and drawings
are not redistributed as freely licensed game assets.

| Landmark | Verified primary reference | Modeling facts |
| --- | --- | --- |
| Skanderbeg Building / Tirana's Rock | https://www.mvrdv.com/projects/461/skanderbeg-building | 85 m; northeast square corner; 25 levels comprising retail, four office levels and twenty residential levels. Curved balconies form Skanderbeg's face and beard, with pale gradient glass, planters and underside lighting. Architect map: 41.3298048, 19.819372. |
| Tirana's Rock structure | https://ales.al/construction/projects/tiranas-rock/ | Contractor corroborates 85 m and Dibra Street. Its July 2023 end date refers to reinforced-concrete works, not necessarily whole-building completion. |
| InterContinental tower | https://www.aeiprogetti.com/en/projects/intercontinental-hotel-tower/ | Structural engineer specifies 135 m, behind the original Tirana International Hotel. |
| Book Building | https://51n4e.com/projects/book-building/ | Three separate masses on a site beside the mosque and clock tower, between Toptani and 28 Nëntori streets. |
| Alban Tower | https://www.archea.it/en/the-alban-tower-was-inaugurated-on-13-may-23-in-tirana/ | Architect's 2023 completion account specifies 105 m maximum, four unequal colored volumes, green mineral base and aluminum facade panels. |

## Other sources inspected

| Source | License / availability | Decision |
| --- | --- | --- |
| https://poly.pizza/m/lg9AKWejnF — Quaternius Traffic Light | CC0, FBX/glTF | Useful lightweight prop; assess the existing street furniture before adding duplicates. |
| https://poly.pizza/m/PKsbolkZSr — Quaternius Dumpster | CC0, FBX/glTF | Candidate street detail. |
| https://poly.pizza/m/MujITy1NRR — Quaternius Debris Papers | CC0, FBX/glTF | Candidate small clutter, suitable for instancing. |
| https://sketchfab.com/3d-models/eyes-of-tirana-d25c07d8c69e46b2a5a9f100e33464d8 | CC Attribution; 154.7k triangles; uploaded April 2021 | Not acquired: predates the current built facade and requires optimization plus attribution. |
| https://github.com/pmndrs/ecctrl | MIT | Reviewed controller and animation-state reference; adding its Rapier/R3F dependency stack is not necessary to repair existing simulation. |
| https://github.com/Mugen87/yuka | MIT | Reviewed navigation, perception and state-driven AI reference. |
| https://github.com/swift502/Sketchbook | MIT; archived October 2024 | Reviewed TypeScript character/aircraft state-machine reference; avoid copying its obsolete dependency stack. |

Poly Pizza and Sketchfab contain different licenses per asset; their whole
catalogues are not uniformly CC0. No paid asset, noncommercial-only asset,
or proprietary game character was obtained for this update.
