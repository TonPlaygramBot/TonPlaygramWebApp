# Racing Royal competition update

Racing Royal now has a solo time trial alongside the existing AI, multiplayer,
career and free-roam modes. The production garage, renderer, karts and shared
fixed-step physics remain the entry point.

## Racing and personal records

- Three flying laps, four ordered sector splits and a translucent personal-best
  ghost. The ghost uses recorded positions and yaw, has no collision body, and
  fades when it overlaps the player.
- A recovered lap cannot become a record. Storage is versioned and separated by
  kart and circuit geometry. Malformed recordings are rejected. If device
  storage fails, up to eight recent ghosts remain available within the renderer
  session, with a visible save warning.
- Solo runs do not grant career wins, credits or TPG rewards. Online timing and
  statistics come from the shared server simulation; ghosts remain local-only.
- Nearby race positions use distance gaps in metres, not estimated time gaps.
  The driving report shows best valid lap, top speed, drift distance and time
  spent slipstreaming. New sector and rev displays also work in career races.

## Driving feedback

- A fixed-step cosmetic six-speed drivetrain feeds RPM, shift feedback and the
  rev display. It does not alter acceleration or speed limits.
- Engine fundamental, harmonics, intake, wind and road noise respond to throttle,
  RPM, shifts and road surface. Tire scrub follows slip and disappears in the
  air. Nearby rivals have two bounded stereo voices. Landings, impacts, turbo,
  countdown and lap completion have distinct cues. Sound is synthesized locally;
  there are no new streams or third-party sound downloads.
- Driver head anticipation and landing response complement the existing wheel,
  hand, foot and suspension animation. Gear changes briefly unload the chassis;
  reduced-motion mode suppresses this extra movement.
- GLTF loading supports Draco, KTX2 and Meshopt with bounded decoder workers.
  Existing models and their textures are reused.

## AI reliability

Rivals reserve boost when another kart is cutting into their path and avoid
wasting stored boost during an existing turbo. A jammed AI chooses a clear lane
behind its current route position, instead of resetting into the same pack at
the road centre. Recovery cannot award checkpoints or forward distance.

## Validation and remaining checks

- Full six-kart simulations finish three ordered laps on all nine circuits at
  rookie, street and pro difficulty, including the previously reproducible Lana
  traffic jam.
- New tests cover sector sums, recovery invalidation, actual simulated-lap
  recording/reloading, ghost interpolation and corruption, storage failure,
  gear hysteresis, cut-in boost discipline and safe backward AI recovery.
- Existing touch, physics, suspension, kart model, driver framing, career and
  multiplayer authority tests were exercised. The garage navigation tests check
  time-trial launch and verify that a solo finish cannot earn career rewards.
- TypeScript checking and Vite production bundling succeed. The subsequent
  whole-app offline-download packaging step needs the untracked
  `assets/external/manifest.json`, which is absent in this checkout.
- The old `every circuit uses source road widths` test in
  `racingEnvironmentCollision.test.mjs` still fails at `skanderbeg road edge`;
  the same failure was reproduced on unchanged `main`. This update does not
  alter the shared city or circuit widths.
- The supplied browser reports WebGL disabled, so live GPU rendering, perceived
  audio quality and real-phone FPS still need device verification. Geometry and
  driver-camera framing were checked by the existing Three.js tests.

The standalone review is built with
`node tools/previews/build-racing-competition-review.mjs /absolute/output`.
It runs the actual production racing component. Multiplayer is disabled there
because the preview has no account/matchmaking server; the main app integration
is preserved.

On a phone, check a time trial, a six-kart race, driver/chase camera switching,
two-thumb gas/steering/drift input, sound mute/pause/resume, and replay against
the saved ghost before merging to the deployment branch.
