# Forcat e Shqipërisë — asset collection v2

14 editable Blender assets and glTF 2.0 binary exports: 8 vehicles and 6 uniformed characters. This revision replaces the primitive human bodies with MakeHuman anatomy and fitted community clothing, and replaces the compact-car and transport-van shells with detailed licensed models. Models are in metres; GLB is Y-up, with vehicles facing +X.

## Open the collection

- `glb/`: self-contained models with embedded PBR textures.
- `blend/`: editable Blender 4.5 source scenes, with packed textures.
- `renders/`: actual Blender renders of the exported designs.
- `source/`: offline rebuild scripts, selected upstream assets, license headers, and attribution.
- `preview-source/`: React + Three.js + TypeScript preview and simple driving controller.
- `manifest.json`: triangle counts, file sizes, wheelbase, and animation names.

The online preview supports touch orbit/zoom, vehicle test driving, flashing lights, and character Idle/Walk clips. WASD/arrow keys also drive. The GLB contains geometry, materials, rigs, pivots and clips; vehicle physics/controller integration in another game engine is still required. The supplied preview controller is a simple game driving model, not a calibrated vehicle simulation.

## What changed

- Full MakeHuman head/hand anatomy and skin UVs; 163-bone deformation rig with transferred garment weights.
- Community-made collared shirt, cargo trousers, fitted cap and leather boots, with geometric seams/folds.
- Distinct patrol blue vest, fluorescent road-police clothing, red/navy Shqiponja panels, FNSH vest, black RENEA equipment, and pixel camouflage army variant.
- Curved Ford Focus/Subaru donor bodies, detailed Sprinter body/interior, textured alloy wheels and road tires.
- Reference-informed dark armored RENEA hull, small ballistic windows, protected lighting and exterior hardware.
- Revised police motorcycles with drivetrain detail, curved screens, tapered lights and touring equipment.
- Baked UV paint bands, normal/roughness maps, source skin/eye/boot atlases and Poly Haven studio HDRI in the preview.

## Reference fidelity — read before production

This is a substantial visual upgrade, **not a photorealistic or exact 1:1 reconstruction of the Albanian fleet or every uniform**. Open licensed donor availability limits exact vehicle identities. Badges are simplified original interpretations; the uniform cut and camouflage are adaptations. The pack does not claim official endorsement.

| Asset | Actual model basis | Fidelity note |
|---|---|---|
| patrol_hatch | Ford Focus donor by Neubi | Albanian white/blue livery; not an exact Škoda Octavia |
| patrol_sedan | Subaru Impreza hatch donor by lubomircenovsky | Legacy ID retained; geometry is a hatchback, not a sedan |
| shqiponja_compact | Ford Focus donor | Shqiponja markings; not an exact Hyundai Kona |
| police_van | Mercedes-Benz Sprinter by Cyberbotics | White/blue transport interpretation; not a Ford Transit replica |
| fnsh_armored_van | Mercedes-Benz Sprinter by Cyberbotics | FNSH transport van; armor is not established by the references; legacy ID retained |
| renea_armored_van | Original photo-informed armored 4×4 | Exact manufacturer/model unconfirmed |
| traffic_bike | Original touring motorcycle + licensed drivetrain detail | Photo-informed configuration, not an exact manufacturer replica |
| shqiponja_bike | Original naked police motorcycle + licensed drivetrain detail | Shiver-inspired configuration, not an exact Aprilia replica |
| All six people | MakeHuman + community garments | Shared male base, distinct equipment/materials; adapted rather than regulation-certified uniforms |

High-detail meshes are supplied, not a complete production LOD set. Characters include simple in-place Idle and Walk clips; finger bones are present but hand/face animation libraries are not included. No engine-specific collision, seating/entry animation, damage system or network driving integration is claimed. Vehicle glass uses tinted reflective PBR; motorcycle screens use alpha transparency.

## Rebuild offline from the full pack

Use Blender 4.5.3 or compatible 4.5 release. Run from `source/`:

```sh
blender -b -t 4 -P build_vehicles.py -- patrol_hatch patrol_sedan shqiponja_compact police_van fnsh_armored_van renea_armored_van traffic_bike shqiponja_bike
blender -b -t 4 -P build_v2.py -- patrol_officer traffic_officer shqiponja_officer fnsh_officer renea_officer army_soldier
```

The smaller website `Blender-Builder.zip` contains scripts and a downloader, rather than all upstream source assets. Run `python fetch_sources.py` first; this needs Internet access and downloads the selected openly licensed source packs. Individual packed `.blend` files can be edited directly without that download.

## Licenses

This pack is **not all CC0**. MakeHuman core anatomy/rig/skin and Poly Haven materials are CC0; garments include CC-BY assets; vehicle donors include CC-BY-SA and Apache-2.0. Keep credits and upstream notices, and honor ShareAlike on the relevant vehicle derivatives. See `ATTRIBUTION.md`, the original source headers and `source/sources/` notices. Reference photographs are linked in `REFERENCES.md` and are not redistributed.
