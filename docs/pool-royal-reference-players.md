# Pool Royal reference players

Pool Royal now creates two human player rigs and gives the active seat the supplied aiming and striking poses. The previous spawn function only removed characters, and its inactive animation code used different body targets.

`webapp/src/pages/Games/shared/poolRoyalReferenceHuman.ts` contains the character equations from the supplied `Pasted text(20260907-065835).txt`. It preserves the original model yaw of `Math.PI`, root yaw convention, body and limb targets, wrist bases, finger poses, easing, breathing, walking and strike lock. In particular, the original wrist quaternions are retained without normalization or new facing corrections.

`PoolRoyalHumanPlayers.ts` loads the same Ready Player Me character once and creates independent skinned clones for seats A and B. The pose solver runs in an untransformed scene; the rendered characters receive a positive uniform scale and a floor offset to match the game's cloth height. Table-edge selection uses the game's table dimensions. This avoids applying the game world's transform twice to bones.

The game supplies its turn, charge/strike state, shot power, aim and current cue endpoints after updating the existing cue timeline. Characters do not move the gameplay cue, apply shots, update ball physics, change the camera, or decide turns. The inactive player holds the upright reference cue. During a strike, the shooter retains the initial ball position, aim, root and yaw; during replay, live characters are hidden because replay recordings do not contain character tracks. Scene disposal also handles a model load that completes after leaving the game.

## Verification

- `npm run test:pool-players`: five behavioral tests, including 24 pose snapshots across four aim headings. Every snapshot compares all 67 original bones against values generated directly from the uploaded reference solver, rounded to eight decimal places.
- `npx jest --runInBand test/poolRoyaleCueStrokeTimeline.test.js test/poolRoyaleShotState.test.js`: existing cue and shot regressions.
- `npm run build --prefix webapp`: production bundle and local model asset.

The numerical fixture is `test/fixtures/poolRoyalReferencePose.json`. Do not regenerate it from the new implementation; a change requires comparison with the supplied reference.

## Character preview

Run `node scripts/build-pool-players-preview.mjs /workspace/pool-royal-players.html` to create an inline React/Three.js preview with Stand, Aim, Strike, direction, power and seat controls. It imports the production character modules. It displays a simple table for inspecting the characters, rather than the full game UI. On narrow screens the camera pulls back along the original viewing direction. Only preview textures are reduced to 256 pixels; vertex positions, skinning, skeletons and animation calculations are unchanged. The preview uses the existing Three.js software renderer if WebGL is unavailable. Production continues to use WebGL.

The full-resolution production asset is `webapp/public/assets/pool-royale/readyplayer.me.glb`, copied unchanged from the URL in the supplied code: https://threejs.org/examples/models/gltf/readyplayer.me.glb. The GLB identifies its generator and copyright holder as Ready Player Me. Its embedded metadata is preserved. The supplied Sketchfab table and its separate assets are not used by this change.
