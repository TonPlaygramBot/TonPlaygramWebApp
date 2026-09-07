# Pool Royal reference players

Pool Royal uses two independently skinned copies of the supplied Ready Player Me character. The original reference equations live in `poolRoyalReferenceHuman.ts`; their default behavior remains covered by the unchanged 67-bone reference fixture.

## Table calibration and player perspective

The first integration scaled the entire character by the floor-to-cloth distance. On Pool Royal's tall table that made the standing model approximately 124.5 game units high. The calibrated model is 88.97 units high, about 28.5% smaller. `PoolRoyalHumanPlayers.ts` uses the actual table footprint, a minimum reach proportion, and the loaded model's measured height. Its scale remains uniform; the model's original `Math.PI` orientation and bind matrices are unchanged.

The cloth target is independent of body size and now uses the rendered cloth plane, including its lift and drop. Stance selection stays behind the shot line with clearance at the table perimeter. The original easing, breathing, turn ownership, and frozen strike root/heading remain in use.

`poolRoyalPlayerPose.ts` applies the requested game-specific refinements after the reference pose:

- Lower the shooting head through the spine while retaining the hips and original foot stance.
- Solve the bridge arm with its measured bone lengths. For longer reaches, slide the bridge back along the cue line instead of stretching bones.
- Orient the left hand using its actual longitudinal +Y axis and a unit, orthonormal wrist rotation.
- Spread the supporting fingers, fit their visible skinned pads to the cloth, and position the thumb alongside the index to leave a cue channel. The arm and fingers keep their original bone lengths.
- Average the two eye bones, apply a small forward offset, and aim along the shot line. All returned camera points are in the game world's local coordinates. The game applies the parent transform once and blends to the eye pose as the cue camera lowers.

In player view, only the active player's face and headwear meshes are hidden to prevent the hat or face from covering the camera. Both heads reappear in the other views. Top view, shot cameras, and replay retain their existing ownership. Characters do not advance shots, change cue motion, alter ball physics, or decide turns.

## Verification

- `npm run test:pool-players`: nine tests covering the unchanged reference trace, independent seats, transformed parents, strike lock, replay/disposal, real-table size reduction, cloth contact across four headings and three power levels, eye position/head visibility, and a cue-axis intersection check against the actual skinned hand triangles.
- `node_modules/.bin/jest --runInBand test/poolRoyaleCueStrokeTimeline.test.js test/poolRoyaleShotState.test.js`: nine existing cue/shot tests.
- TypeScript check of the preview and imported character modules; full `npm run build --prefix webapp`.

The numerical reference fixture is `test/fixtures/poolRoyalReferencePose.json`. It is generated from the original supplied solver and is not rewritten to accommodate the calibrated pose.

## Visual inspection loop

Run `node scripts/build-pool-players-preview.mjs /workspace/pool-royal-player-view.html`. The React/Three.js preview uses the production controller and reads the actual game dimensions, cloth/ball heights, cue length and baseline pull distances through `scripts/read-pool-royal-metrics.mjs`. Its table is a simplified inspection model, not the complete arena. Player view uses the game's 66-degree lens; table view frames both figures; bridge view exposes the finger contact. Stand, Aim, Strike, seat, power, direction and pause controls support repeatable inspection.

Portrait review exposed an obstructing hat, a too-high shooting head, and a cue/bridge intersection. Each was corrected and rendered again. Geometry checks now verify the cloth contact and cue channel. The review browser has WebGL disabled; its visual checks use the existing software renderer with the same meshes and skeletons. Full arena lighting and on-device WebGL performance remain an on-device review item. The software renderer has limited near-plane clipping and depth sorting; the inspection table is subdivided to keep its cloth visible in the close view. Preview textures are reduced to 256 pixels, while production uses the unchanged original model.

## Asset provenance

`webapp/public/assets/pool-royale/readyplayer.me.glb` is unchanged from https://threejs.org/examples/models/gltf/readyplayer.me.glb, the URL supplied in the reference. It identifies Ready Player Me as its generator and copyright holder. Its original metadata is retained. The supplied Sketchfab table is not used.
