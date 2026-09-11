# Racing Royal: Blender kart fleet

The existing five kart IDs now load original Blender-authored models in the real Racing Royal garage and race renderer. Military vehicle choices remain available.

| ID | Kart | Distinct geometry |
| --- | --- | --- |
| apex | Apex Sprint | Open welded chassis, compact sprint bodywork |
| oobi | Eagle Shifter | Side radiator and manual gear lever |
| oodi | Illyrian Drift | Low rear wing and diffuser |
| ooli | Besa Endurance | Rear fairing, fuel tank and headlights |
| oopi | Dajti Cross | Raised chassis, knobby tyres, roll hoop and skid plate |

All have a bucket seat, harness, separate steering wheel, engine cooling fins, exhaust, rear axle, chain guard, tie rods, machined rims and independently rotating wheels. These are original game models, not manufacturer replicas.

## Build and assets

Run from repository root with Blender 4.2 LTS and Python 3:

```sh
blender -b --python tools/blender/racing_karts.py
python tools/blender/pack_kart_textures.py
```

Editable, packed `.blend` files and source textures live in `assets-source/racing-karts/`. The checked-in `textures/sources.json` records the downloaded Poly Haven **metal_plate** source URLs, SHA-256 hashes and CC0 license. Diffuse, OpenGL normal, roughness and metalness maps are wired into the Blender Principled shader, exported to glTF PBR, and shared between all ten GLBs. No runtime requests go to Poly Haven. UVs and material joins are authored by the builder. The original kart geometry is licensed CC0-1.0 by this contribution; see the asset license.

The game loads `webapp/public/assets/kart-royale/karts/`. **Keep the `textures` subfolder next to the GLBs:** exported files reference those same-origin images to avoid ten duplicate embedded sets. High and low geometry plus shared textures total approximately 5.4 MB. Opponents use the low geometry. This is a geometry LOD and JPEG texture optimization, not KTX2/ASTC compression.

Units are metres, +Y up, +Z forward. `body` owns the chassis; `steer_fl/fr` pivot about Y; `wheel_fl/fr/rl/rr` spin about X. `driver_eye` and `exhaust_mount` are authored attachment markers. The existing adapter normalizes the race footprint and driver eye/radius consistently. Steering responds in the established chase-camera screen directions.

## Driving and effects

- Existing automatic forward drive, progressive steering, drift charge/boost, damage, sparks, skid marks, engine sound and collision response remain.
- **R** or hold **REV** brakes into reverse, capped at 7 game metres/second. Release resumes forward drive; the separate brake stops either direction. Reverse is sanitized by the server and cannot boost.
- A sufficiently energetic lateral impact starts a server-owned 2.2-second tumble/inverted/recovery state. Controls cannot skip it; a cooldown prevents repeated flips. Ordinary steering and small/head-on contacts do not trigger it.
- Bounded 192-particle tyre/braking/damage smoke uses one GPU draw. Wheel spin reverses with signed speed; audio uses speed magnitude.

Physics intentionally extends the existing deterministic 60 Hz **arcade planar simulation**. Rollover timing, orientation and lift are a constrained state machine, not a new full 3D rigid-body solver. There is no soft-body crash deformation, independent suspension physics or manually selectable gear system.

## Preview and verification

`webapp/kart-fleet.html` is a React + Three.js TypeScript rig inspector for development. Its motion buttons demonstrate the rigs; it is separate from actual race controls. The in-chat preview uses the same low geometry with 128px maps to stay compact; production uses 1K maps.

```sh
node --test test/racingKartDynamics.test.mjs test/kartRoyale.test.mjs test/racing-precision.test.mjs test/racingMilitaryVehicles.test.mjs
node test/racingKartFleet.browser.mjs
cd webapp && npm run build
```

Browser evidence is captured at 390×844 in the actual `KartRenderer`, with successful model and texture responses, four wheels/two steering pivots per kart, reverse movement, inverted pose and recovery. The rollover visual check seeds its timer; unit tests exercise collision triggering. Software WebGL is not a physical-phone frame-rate benchmark.

The lobby picker uses horizontal touch swipes and previous/next buttons, with wraparound through all nine vehicles. It locks while a multiplayer room owns the selected appearance. The actual React lobby browser check verifies all nine rigs, both native touch swipe directions and starting the selected kart with the race button. Run `node test/racingKartLobby.browser.mjs`.
