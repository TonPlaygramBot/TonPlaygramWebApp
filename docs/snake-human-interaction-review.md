# Snake and Ladder human interactions

The next-player refinement is based on main after PR #25916. The old die rested too far inside the board and an independent turn animation slid it between seats. The firing hand also used the orientation of a horizontal bar rather than an upright pistol grip.

Dice now land on the open tabletop directly in front of the receiver's torso, between the board and the player. Chairs sit closer to the table so that this spot is physically reachable without torso lean or hip translation; the existing camera distance is retained. The die stays still through reach and finger closure, follows the hand through the lift, and leaves with the same velocity as the hand. A world-space ballistic flight and two diminishing bounces replace the old eased flight. There is no separate turn-change handoff. The result stays still for 750 ms before movement/turn presentation proceeds. An actual portrait-camera sightline check caught the local shirt blocking the die: only obstructing clothing/parked meshes temporarily become transparent during the action. Skin and hands remain opaque, shared materials are cloned for the effect, and disposal restores the original materials. Camera position and the physical die position stay unchanged.

Local presentation predicts the receiver using the current position, rolled faces, snakes, ladders and bonus cells, preserving local reverse turn order and the existing AI penultimate-tile behavior. Online roll events explicitly announce `nextPlayerId` from the server's resolved turn; an older-server fallback uses current board state and forward order. This does not change movement or turn ownership. Two- and three-player online seat assignments now reference the chairs that actually exist.

Firearms retain the shared Ludo firing timing, ammunition, recoil and effects. The right hand aligns with the upright grip, the left hand supports the fore-end or cups the pistol, and bounded finger flexion follows the grip volume and trigger contact. The weapon rotates around the firing hand with a lifted draw path, rather than swinging around its mesh origin. Dice use a separate oriented-cube pinch with thumb opposition and limited knuckle spread; contact targets stay above the tabletop for all six landed orientations. The shipped Poly rifle, pistol and shotgun have contacts measured in their authored geometry. Those measurements are applied only when the matching mesh exists; other models use authored sockets or family profiles. Parked and held scale remains identical.

## Validation

- `npm run test:snake --prefix webapp`: 82 tests pass, including real-avatar pickup and firearm tests, consecutive turns for 2/3/4 players, unchanged spine/hip pose during pickup, release velocity continuity, exact final position and face, 30/60/90 Hz and skipped frames, actual imported weapon grips throughout draw and recoil, six-face thumb contact and tabletop clearance, selective visibility/material restoration, and local/online input locks.
- Receiver prediction is compared with the actual server game across 324 combinations of player count, roller, position and die face, including snakes, ladders and bonuses.
- `node --test test/snakeGame.test.js`: 15 tests pass, including receiver announcements on ordinary, six and bonus turns.
- TypeScript check of the interaction and preview modules passes.
- Production Vite build and generated game packs pass.
- Portrait reviews use the actual skinned avatar, board and imported weapons. All four result positions pass ray checks from the production portrait camera with no opaque obstruction, and the CPU review renderer now composites transparent materials. Measured palm/die and palm/weapon contact gaps remain below 0.003 scene units. Finger joints retain their authored lengths and flexion limits; the marker tests are not a guarantee that every skin vertex is collision-free.

## Reproduce the portrait review

1. `node scripts/build-snake-interaction-preview.mjs /workspace/snake-front-result.html`
2. `node scripts/check-snake-interaction-preview.mjs` (requires `@napi-rs/canvas`).
3. `python scripts/snake-review/render.py scripts/snake-review/polyAssaultRifle01Attack-aim.json scripts/snake-review/polyPistol01Attack-aim.json scripts/snake-review/polyAssaultRifle01Attack-result.json` (requires NumPy and Pillow).

The React + Three.js preview shows two consecutive dice turns, a Show result control, and selectable firearm animations with pause and scrubbing. It omits texture maps and facial morph targets to fit the in-chat size budget; gameplay retains the original materials. Generated assets and sampled frames are ignored by git.

Live browser/Telegram verification remains unavailable in this environment. Portrait frame checks use CPU rasterization of Three.js deformed meshes, not WebGL screenshots. External store models without authored sockets have not all been individually visually calibrated. A phone review remains necessary before calling the result visually perfect.
