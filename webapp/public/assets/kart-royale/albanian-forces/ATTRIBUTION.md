# Asset provenance and attribution

The supplied sources preserve the authors' original license headers. Original modifications include fitting, rig transfer, remeshing, equipment, liveries, materials and glTF export. Do not describe the entire collection as CC0.

| Included work | Author / source | Upstream license | Modifications |
|---|---|---|---|
| MakeHuman base mesh, male morph, default rig and skin weights | MakeHuman Community; Data Collection AB, Joel Palmius, Jonas Hauquier, Manuel Bastioni and credited contributors | CC0 | Full anatomy fitted, hidden body surfaces removed, skin rigged |
| Male diffuse skin and eyes | MakeHuman system assets | CC0 | PBR setup and JPEG export |
| Collared male shirt | Elvaerwyn, `elvs_male_shirt_untucked_bd1` | CC-BY (upstream header: `CC_by`) | Uniform material, shirt hem fitting, garment weight transfer |
| Cargo trousers | Elvaerwyn + Punkduck, `elvs_emt_uniform_pants_male` | CC-BY 4.0 | Uniform materials, stripe variant, fit and skin weights |
| Leather biker boots | Mindfront (Sweden), `mindfront_shoes_biker_boots_male` | CC-BY 4.0 | Upper shaft trimmed for duty-boot use; PBR/rig transfer |
| Fitted cap geometry | MRT, `toigo_maga_hat` | CC0 | Plain uniform material; original graphic not used |
| Ford Focus body/interior/wheel | Neubi; Stunt Rally source repository | CC-BY-SA (version not stated in the Focus source notice) | Coordinate conversion, police liveries, PBR atlases, wheel pivots; Focus wheels also used on Sprinter variants |
| Subaru Impreza body/interior | lubomircenovsky; Stunt Rally | CC-BY-SA 3.0 | Coordinate conversion, police livery, wheel pivots |
| Mercedes-Benz Sprinter body, interior and lamps | Cyberbotics Webots | Apache License 2.0 (Sprinter PROTO header) | Conversion to Blender/glTF, UV regeneration, liveries and wheel integration |
| Motorcycle mechanical donor, BV | gakpoenya; Stunt Rally | CC-BY (upstream notice does not state version) | Only selected drivetrain geometry/atlas retained in final bikes |
| Denim Fabric, Brown Leather | Poly Haven | CC0 | Normal/roughness materials |
| Studio Small 09 | Sergej Majboroda / Poly Haven | CC0 | 4K EXR resized to 1K Radiance HDR for web reflections |

MakeHuman core: https://static.makehumancommunity.org/about/license.html

Community packs: https://static.makehumancommunity.org/assets/assetpacks.html

Garment packs: https://static.makehumancommunity.org/assets/assetpacks/shirts02.html ; https://static.makehumancommunity.org/assets/assetpacks/suits03.html ; https://static.makehumancommunity.org/assets/assetpacks/shoes03.html

Ford Focus donor: https://github.com/stuntrally/blendfiles/tree/master/cars/FN ; author page recorded upstream: https://www.blendswap.com/blends/view/15406

Subaru donor: https://github.com/stuntrally/blendfiles/tree/master/cars/S8 ; author page: https://www.blendswap.com/blends/view/47523

Motorcycle donor: https://github.com/stuntrally/stuntrally/tree/master/data/cars/BV ; author page: https://www.blendswap.com/blends/view/60751

Sprinter: https://github.com/cyberbotics/webots/tree/master/projects/vehicles/protos/mercedes_benz

Poly Haven: https://polyhaven.com/a/denim_fabric ; https://polyhaven.com/a/brown_leather ; https://polyhaven.com/a/studio_small_09

## License handling

Original authored additions and adaptations are available under CC-BY 4.0, except additions integrated into ShareAlike vehicle meshes, which follow the applicable upstream ShareAlike terms. The donor Focus wheel makes the combined Sprinter exports a mixed-license derivative; preserve both the ShareAlike donor attribution and the Apache notices. No relicensing of third-party source material is claimed. Where upstream only states CC-BY or CC-BY-SA without a version, that ambiguity is recorded rather than silently inventing a version. The upstream source notices and linked author records remain authoritative.

Original rebuild and preview code is provided under MIT; bundled data remains under its own licenses. No Webots assets marked “Licensed for use only with Webots” are included: the restricted BMW/Citroën/motorbike candidates were rejected.

Standard license texts: https://creativecommons.org/publicdomain/zero/1.0/ ; https://creativecommons.org/licenses/by/4.0/ ; https://creativecommons.org/licenses/by-sa/3.0/ ; https://www.apache.org/licenses/LICENSE-2.0

## Racing Royal integration

TonPlaygram generated smaller GLBs with glTF Transform 4.2.1 and Meshoptimizer
0.23.0: deduplicate/weld geometry, simplify LOD meshes, resize embedded textures
to at most 1024px (full) / 512px (LOD), and re-encode JPEG/PNG. Liveries, materials,
articulation, skinning and Idle/Walk clips are retained. No additional restricted
models or reference photographs are redistributed.

Modified models retain the applicable licenses above. The repository MIT license
applies to integration code, not third-party models. `notices/` preserves the
upstream notices and license headers supplied with the archive.
