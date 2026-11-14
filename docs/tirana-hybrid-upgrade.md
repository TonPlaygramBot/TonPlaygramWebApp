# Tirana Streets: driving, combat and presentation upgrade

This change targets the live solo path: `TiranaStreets.jsx` → `Blackwater.jsx` →
`blackwater/ui.tsx` → `StreetCareerGame` → `StreetCareerRuntime`. It combines a
new mixed mission with concrete improvements to vehicle handling, city combat,
character animation and original glTF rendering.

## Play City response

Open Tirana Streets, select Turi and a loadout, then choose **MENU → OPERATIONS →
City response**. A direct entry is `/games/tiranastreets?mode=ai&map=city-response`.
An existing active job is preserved when opening a link.

1. Enter a car, follow the driving route to the river staging point and stop
   below 0.6 m/s for one continuous second.
2. Dismount, clear the armed crew, then approach the marker on foot and use
   **RECOVER DISPATCH**. Remaining opponents, airborne movement and being inside
   a vehicle cannot collect the dispatch.
3. Enter a car and drive to the Blloku safe point. Lose any pursuit and remain
   below 0.6 m/s inside the marker for three continuous seconds. Taking damage,
   firing, moving away or becoming wanted resets the hold.

The route, map marker, world beacon and HUD advance with the mission stage.
Stages and hold time survive the existing checkpoint system. The first
completion pays 850 local street cash at normal difficulty; replaying does not
pay again. This mission is excluded from shared server rooms because its
director belongs to the local simulation. Existing map links still select their
previous operations.

The actual map routes were checked with `StreetWorld` and the road graph:
spawn to staging is approximately 430 m, the on-foot approach is 447 m, and the
driving extraction route is 514 m. All destinations have player clearance and
accept the sedan footprint.

## Gameplay and animation

- Tyre recovery applies a bounded lateral force. Fast slides retain momentum
  instead of snapping to the vehicle heading; braking uses part of the grip
  available for turning. Collision feedback uses resolved velocity.
- Stopped traffic no longer rotates toward its next waypoint. Moving traffic
  provides steering angles to wheels and driver hands.
- Armed NPCs use stable flank destinations, pauses after three actual shots,
  short suppression after hits, and reachable stationary-vehicle cover. They
  check space before peeking and stop refreshing stale sightings through walls.
  Cover searches are bounded and cached.
- Turi retains the existing original Idle/Walk/Run clips and textures. The
  lower-body stride follows sideways/backward movement while the head and weapon
  keep their aim. Foot roll is preserved. Static rigs and crouch steps use the
  same movement direction.
- Police animation fading uses elapsed time independently of walking cadence;
  teleports and resumed frames no longer trigger catch-up sprint animation.

## City assets

City and imported-asset loading supports local Draco, KTX2 and Meshopt codecs.
Anisotropic sampling improves texture detail without recolouring the source,
changing alpha cutouts, modifying UV transforms or treating packed PBR maps as
colour textures. Original sources and attribution remain unchanged.

Nearby facades retain authored detail even in battery mode. Detail selection
uses distance to a building's edge, with hysteresis and bounded full-detail
counts. Nested or absent LOD nodes use the available authored mesh. Imported
models use bounded retries, preserve sources while placements are being cloned,
and release instances and codec resources safely when leaving the game.

The existing CC0 broadleaf-tree glTF now prioritizes trees in the camera view,
out to 125 m (75 m in battery mode). Turning the camera refreshes selection.
The same eight/three original-model slots are retained, so trees behind the
player no longer consume the entire visible-detail allowance. Cypress and
upright tree silhouettes are preserved.

The Battlefield presentation no longer draws substitute boxes for imported
props. Their existing simulation collision remains in place while the original
models load; unavailable assets are reported in the existing diagnostics.

This is not a replacement of all city art. Existing terrain, distant canopy and
some city geometry remain generated. No new high-resolution city pack or new
motion-capture assets are introduced. Mobile triangle and actor limits remain
bounded; physical-phone performance and visual appearance still require review.

## Verification

Run the focused integration checks from the repository root:

```sh
node --test --test-concurrency=1 test/tiranaCityResponse.test.mjs test/tiranaUnifiedCampaign.test.mjs test/tiranaMissionDirector.test.mjs test/tiranaUrbanTactics.test.mjs test/tiranaTyreAndTrafficMotion.test.mjs test/tiranaCityAssetStreaming.test.cjs test/tiranaVisibilityBudget.test.cjs test/tiranaUploadedPlayerRigs.test.mjs test/tiranaFullBodyPresentation.test.mjs test/tiranaAlbanianForcesRuntime.test.mjs
webapp/node_modules/.bin/tsc --noEmit -p webapp/tsconfig.tirana-gameplay.json
node test/tiranaHybridUpgrade.browser.mjs --build-only
```

After the project's normal asset preparation, the actual portrait browser check is:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node test/tiranaHybridUpgrade.browser.mjs
```

The browser harness runs the real React route and real simulation at 390×844 and
320×740, with an account-balance fixture. It does not mock drawing or physics.
The build-only command compiles the unchanged production route. During this
task Chromium could not launch because the environment denied its process
singleton socket, so browser screenshots, a playable in-chat preview and actual
phone FPS were not verified. The full application prebuild/deploy pipeline was
not run; these results are specific to the Tirana route.

The broad sequential checks found an existing canopy-count assertion in
`tiranaPatrolCustody.test.mjs`: 5,150 registered trees versus 4,756 source trees.
The registry includes quarter trees, while that assertion expects equality.
The test, registry and source data are unchanged by this work. Separate baseline
checks also found generated imported-weapon files absent before asset preparation
and outdated racing assertions; they are not treated as passing validation.
