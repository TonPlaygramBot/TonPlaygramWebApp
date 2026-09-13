# Ludo presentation upgrade

Built from `main`. Seated characters are normalized to 1.4616 units (29.2% larger than the previous 1.131), with the pelvis fitted to the same chair seat. The existing die geometry and `spinDice` result/flight logic are unchanged.

The controller now owns reach, grip, windup, and release phases. The die stays at its actual table location for the entire reach; fixed-length arm IK brings the palm to it. A captured grip rotation carries the die through the throw. Stale online animations cancel before changing the die. The head is hidden only for the local player's eye view; the existing turn focus, manual look, 2D toggle, and attack camera logic remain in place.

Weapons use independent world transforms and palm/foregrip contact targets. Each projectile snapshots its muzzle origin and target on launch. Final-shot travel completes before the cinematic ends. Casings eject once per shot from their own origin, settle on the table, and trigger a brass contact sound; revolvers retain cases. The current tile pulses with a three-tile trail. Sound effects are original deterministic sound design, not recorded firearm audio.

## Assets

- Editable source: `assets-source/ludo-presentation.blend`, organized into named collections (truck visible initially).
- Rebuild geometry with Blender 4.0: `blender --background --factory-startup --python tools/blender/ludo_presentation.py`.
- Rebuild sounds: `python tools/blender/ludo_audio.py`.
- Exports: `webapp/public/assets/ludo/presentation/*.glb` and `webapp/src/assets/ludo-presentation.json`.
- Mesh data is indexed and grouped by material for Three.js; factory instances dispose their own resources.
- 23 mesh variants cover projectiles, open casings, 6x6 truck, missile, delta-wing drone, and separate propeller. Existing weapon profiles supply the per-weapon dimensions and caliber metadata.

## Verification

- `node --test test/ludoBattleGameplay.test.mjs test/ludoBattleRules.test.mjs`: 14 tests.
- `node scripts/build-ludo-motion-preview.mjs /workspace/ludo-battle-upgrade.html`.
- `node scripts/check-ludo-motion-preview.mjs`: 19 motion assertions.
- `node scripts/check-ludo-presentation.mjs`: 113 controller and geometry assertions, including the actual shipped dice-pickup closure and stale-animation cancellation.
- `cd webapp && npm run test:snake`: 60 tests for the existing consumer of the shared firearm presentation module.
- `cd webapp && ./node_modules/.bin/vite build`: production compilation.
- Blender renders inspected at 360×470 for character/chair, aim, player view, ammunition, truck, and drone.

The inline preview is a focused motion/asset review, not the complete connected match. Cloud Browser could not open the local server (`ERR_BLOCKED_BY_CLIENT`); live browser rendering, real-device frame rate, all optional imported weapon grips, and multiplayer end-to-end play still need visual QA before merging to `main`.
