# Pool Royal and Snooker Royal player camera review

Camera alignment follow-up based on main `88b952828f8d658596b74b0d227bd02216d80751`,
which includes the initial camera ownership changes in PR #26038.

## Alignment corrections

- Pool's near-rail stance previously removed the minimum distance needed for
  the forward lean. With the real GLB, a cue ball at 35% of the playable table
  length put the settled eyes 1.91 ball radii beyond the ball. Its projected
  vertical coordinate was about -14 (outside the visible -1 to +1 interval).
  Keeping the minimum stance distance puts the eyes about 15.34 radii behind
  that ball, while preserving the existing walking perimeter and planted feet.
- Both exact-eye views now aim so the cue ball is horizontally centered and
  64% down the portrait screen. The gaze uses the actual eye-to-ball angle and
  the production 66-degree vertical FOV. It no longer depends on a target only
  five ball radii ahead, which left long shots almost at screen center. The
  camera remains at the real eye midpoint; only the gaze direction changes.
- Snooker's direct character driver now interpolates yaw over the shortest
  angle. Crossing +180/-180 degrees during a small aim adjustment no longer
  swings the head and eye camera through an almost full turn.
- `test/royalPlayerCameraFraming.node.mjs` exercises the original character
  with both games' production dimensions, both seats, four rails, diagonal
  corners, center/long shots, zero/full power, transformed parents, and
  320/390/430 px portrait projections. It checks the actual cue ball and its
  bounds, not merely whether the chosen look-at target is centered. It also
  checks both directions across the yaw wrap and guards the shared FOV.

These are transform/projection checks, not GPU-rendered screenshots. The
WebGL limitation described below still applies to this follow-up.

Follow-up validation: 111 Node checks and 28 Jest checks passed, including
the final portrait checks with rail/ball clearance and shot-readiness enabled.
The Vite production bundle completed successfully (existing large-chunk and
URL-map script warnings remain). Both portrait preview interfaces were opened
again; both still report that WebGL is unavailable in the test browser. Full
asset-prebuild/Render deployment and live 3D gameplay were not validated.

## Historical reference

The latest main revision preceding 12 July 2026 is
`aec6ccb902f2b84d7219872c05ee4eb0f10ed3d9` (12 June). Pool's camera there derives
its low aiming viewpoint from the cue back with forward/side offsets and blends
from the standing view. That code predates the current September character rig.
This change restores the player-perspective intent using the current eye bones;
it does not claim to reproduce the old camera's pixels or undo later rules,
table mapping, physics, assets or character sizing.

## Changes

- Both games restrict first-person ownership to the local seat. A turn change
  during a shot preserves the original shooter's follow-through; AI and remote
  opponents do not take over the player's eyes.
- Pool snapshots the address view before the stroke and starts its follow-through
  clock at the actual impact callback. The camera remains fixed until the stroke
  is complete and 900 ms have elapsed after impact, then releases to broadcast.
  Changing to an explicit overview does not erase or restart this clock.
- Snooker now uses the midpoint of the actual eye bones without its forward
  offset or overview blend. A separate render camera prevents a player view
  from changing the source pocket/broadcast camera's position, zoom or up axis.
- Snooker prepares the aiming stance immediately after accepting a cue-ball
  placement, even while the rules retain ball-in-hand entitlement. Power input
  is no longer needed to summon the aiming character.
- Local face suppression follows the actual player render camera and retains
  the character in broadcast views. The Snooker 3D button exits Look and
  overhead modes immediately.
- Snooker's launch parser now honors `type=training`, reaching the existing
  practice mode instead of silently starting a regular timed AI match.

## Review page

Open `/royal-camera-review.html` on a deployment containing this branch. The
React/TypeScript page mounts the actual production game components in a
320/390/430 px portrait frame with free practice, through
`/royal-camera-game.html`. It uses their existing Three.js renderer, characters,
table assets, gameplay and controls. There is no replacement demo scene.
Only one game is mounted at a time, and switching/restarting unmounts its frame.

## Verification

The focused Node regression suites cover the actual JSX camera call sites,
both player seats, 30/60/120 Hz rig updates, transformed/scaled parents, fixed
follow-through, opponent turns, manual views, portrait projection, spin pointer
handlers, cue-ball placement, hand/cue alignment, collision/guide geometry,
AI planning and competition persistence. Jest checks visible cue impact,
release queues, rules and shot lifecycle. The pinned Showood GLB was downloaded
with its expected SHA-256 for the two optional real-mesh checks.

Browser inspection reached both games' portrait controls but reported WebGL
unavailable. The browser's URL policy prohibited opening its GPU settings;
no settings workaround was attempted. Therefore actual 3D rendering, real-device
FPS, head/cloth visibility during live play, complete frames and online matches
are not visually verified. A passing source/build check does not establish a
perfect or issue-free game.

Before merging, run both games on a WebGL-capable portrait device: aim from
all rails, place and reposition the cue ball, use all spin quadrants, take a
full-power shot, switch 2D/3D/Look, watch the AI turn, and verify the next local
turn returns to the eyes. Check both local seats for online play.
