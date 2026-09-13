# Tirana player, vehicle and offline upgrade

This change is a draft. The five original Sketchfab rigs have **not** been imported,
and the running game has **not** been visually verified in WebGL in this environment.
The picker contains credited original preview images and disabled entries until the
corresponding reviewed GLBs are installed. The current operator remains playable.

## Changes implemented

- A portrait-friendly player picker precedes the solo runtimes. Online rounds keep
  their existing start timing. Available local
  rigs use the shared first-person body and weapon solver in Career and Battlefield.
  The local player's mesh and animations stay separate from other city actors.
- Helicopter and jet reject moving/airborne boarding. The jet also validates vertical
  proximity. The existing helicopter stair access remains available. Landing samples
  the destination surface, high-speed landings cause damage, and exiting no longer
  replenishes missiles. Non-home exits must stay on the landing surface.
- Emergency vehicle theft clears dispatcher/path ownership. Player collisions use
  oriented vehicle bodies, closing speed, approximate mass, contact cooldowns,
  occupant damage, and short driving substeps. Shared damage starts existing fires
  and single-transition explosions. This is arcade collision response, not soft-body
  deformation or a full vehicle physics engine.
- Player and NPC bullets share nearest cover/body ray tests. Police/military use
  weapon magazines, reload deadlines, recovery delays, range and deterministic spread.
  Player body hits have head/leg multipliers; muzzle obstruction retains vehicle IDs.
- Instanced tracers are bounded by the actual impact, reach distant hits, and survive
  a late first frame. Added crash sparks/dust, gradual death fall, reload/recoil poses,
  damage-dependent vehicle materials and a short collision body roll.
- Tirana downloads include shared characters plus the existing built runtime pack.
  Completed caches store a file receipt; exact cached entries and dependencies are
  checked after eviction. Missing files become resumable, without discarding valid
  files. Catalog/manifest mismatches and source-only Tirana packs cannot be called
  complete offline downloads. Local NPC fallback assets are primed for offline use.

## Original character sources

All five model pages were listed as CC BY 4.0. Preserve author credit, source links,
license and a changes notice with redistributed assets. Previews do not establish
rig compatibility. In particular, the two terrain variants still need a rig audit.

| ID | Model | Author | Source |
| --- | --- | --- | --- |
| tactical | Soldier Full Tactical Gear | DanlyVostok | https://sketchfab.com/3d-models/850593a8c7114c188395ba1849a66eb9 |
| polish | Polish soldier | buh (@buh-late) | https://sketchfab.com/3d-models/fb96a663fc4a4246a57ca85de3228c00 |
| city | City Soldier (outdated) | buh (@buh-late) | https://sketchfab.com/3d-models/636b5a7c7e0c400abda269ba382f3252 |
| forest | Forest soldier (outdated) | buh (@buh-late) | https://sketchfab.com/3d-models/b265975196394070837366de9a0ddb7c |
| sand | Sand soldier (outdated) | buh (@buh-late) | https://sketchfab.com/3d-models/98e1431914c1408f958d9c694352cc92 |

Download the originals through authorized Sketchfab access, embed resources, optimize
textures/mesh for mobile, and review humanoid bones, rest pose, weapon grips, clipping,
walk/run, crouch, reload and first-person head masking. Once reviewed, from `webapp`:

```sh
node scripts/import-tirana-player.mjs tactical /path/to/reviewed.glb --rig-reviewed
```

Repeat for each ID. The script checks basic GLB/rig/resource structure and records
source attribution and a digest. The flag records a **human rig review**, not an
automated retargeting guarantee. Commit GLBs and `players/manifest.json` together,
then rebuild the download packs. Do not set rigValidated just to enable a button.

## Validation loop and remaining gates

Automated checks cover existing movement, flight, vehicle ownership, ammo, saves,
new collision and tracer boundaries, NPC reload and download eviction/recovery.
Typecheck: `webapp/node_modules/.bin/tsc --noEmit -p webapp/tsconfig.tirana-gameplay.json`.
New regression tests: `node --test test/tiranaPlayerVehicleUpgrade.test.mjs test/gamePackRecovery.node.mjs`.

Before making the PR ready:

1. Import and visually review all five original rigs; exercise the picker with each.
2. Run the actual game in portrait WebGL at 390×844 and on a physical phone. Check
   screen directions, both aircraft, service vehicle theft, crash/shot effects, long
   flights and repeated death/respawn. Verify the emergency vehicle appearances:
   existing service entities still use the base game's vehicle models.
3. Inspect PBR maps and skeleton deformation, and measure frame time/texture memory.
   No higher fidelity or phone performance claim has been verified by this patch.
4. Install the complete **production** Tirana pack, stop the network, close/reopen the
   app, launch Career and visit streamed areas. Verify dependency eviction → Resume.
   Downloads are browser/PWA storage, not a standalone native executable; account and
   multiplayer services still need a network. Devices may evict unpersisted storage.

Browser verification was blocked because the browser could not reach the isolated
preview server; exposing the server was rejected by environment approval policy.
Sketchfab's Epic sign-in inspection was rejected by automatic approval review because
it could access private third-party authentication content. Neither blocker was bypassed.
