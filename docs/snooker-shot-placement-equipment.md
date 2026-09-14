# Snooker Royal shooting, placement and equipment

The player camera snapshots its position and target at cue contact, holds them
through the completed stroke and at least 900 ms of follow-through, then yields
to the existing broadcast coverage. The character also keeps the original
shot-ball anchor. Cue-ball movement, including a scratch, cannot drag the
shooter or held camera across the table. Explicit overhead, replay and gallery
views retain ownership. An unsettled or unavailable character uses a fixed
address view behind the shot, measured from the actual rendered ball plane.

Ball in hand now opens a 3D view facing the baulk end; an explicitly selected
overhead view is preserved. Tap or drag places the ball using the existing
world-space ray projection, legal D boundary and collision checks. As in
PoolRoyale.jsx, frame-level ball-in-hand entitlement survives a placement.
The **Move cue ball** control reopens placement until a shot is committed.
Cancelled, lost-capture and unrelated pointer events cannot commit a placement.

The shared extension and rest use original Blender meshes, including nested
tubes, a twist lock, fixed coupling rings, a bevelled brass cross head, cloth
feet and a tapered wood handle. The grip follows the handle. The original
reach-selection rules are unchanged in both games. See
[asset provenance and rebuild instructions](../assets-source/cue-reach/README.md).

## Verification

The focused regression set covers camera ownership and timing, portrait
projection, repeat placement, legal bounds, pointer cancellation, slider
release, exactly-once impact, shared player poses and equipment dimensions:

```sh
node --test test/snookerControls.node.mjs test/snookerCharacterCamera.node.mjs test/cueReachEquipment.node.mjs test/poolRoyalHumanPlayers.node.mjs
node node_modules/jest/bin/jest.js test/snookerLiveStrike.test.js test/snookerShotRelease.test.js test/snookerRoyalQuality.test.js test/poolRoyaleShotLifecycle.test.js --runInBand
cd webapp
node node_modules/vite/bin/vite.js build
```

There are 39 Node checks and 28 Jest checks. Browser checks use a 390 × 844
portrait viewport. The live game check exercises two placements using its real
callbacks, player assets, table and shot logic. Browser QA is offline: backend
multiplayer and external environment downloads are not covered.

## Focused interactive review

```sh
node scripts/build-snooker-interaction-review.mjs /tmp/snooker-review.html
```

The React/Three.js review imports the production camera controller, player rig,
placement projection and equipment. Its table and ball paths are illustrative;
it is not a complete match or a physics replay. The character skeleton is
unchanged; only preview texture resolution is reduced. The production model
is not modified. The HTML fragment uses React/Three.js CDN modules and has no
backend or multiplayer connection.
