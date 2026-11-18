# Snake and Ladder / Ludo Battle Royal presentation parity

Local implementation based on main `9a472aa02afd12f8dd7977d4a888dd775c5f277b`. Not published or deployed.

## Aligned presentation

- Ludo world/model scale, table radius/height/model fit and leg extension, board footprint, chair dimensions/radius/pushback, seated human target height/offsets, dice size and bounce.
- Both games now import the same authored Ludo seated pose/feet-grounding implementation and per-model parked-weapon size calculation. Ludo's implementation was extracted, not replaced with a different pose.
- Same player-view 78° lens, live seated eye anchor, orientation-dependent camera tuning, zoom limits and reset behavior. Removed Snake's automatic portrait FOV widening to match Ludo's fixed lens.
- Shared dice broadcast framing and timing; shared firearm shoulder/projectile/impact camera pose math and frame-rate-aware smoothing. Manual/overhead views cancel cinematics; reduced motion remains respected.
- Same shared HUD controls, avatars, Table Setup menu structure/styling and Center camera action. Extra tile badges were removed from avatars, with positions/connection state preserved in accessible labels. Snake's turn timer/roll control and rules remain available.

## Preserved gameplay and deliberate differences

Snake's raised board, path, snakes/ladders, reserve tokens, rules, 50-tile finish, entry/exact-roll/capture behavior, payouts and online ownership remain unchanged. Customization ownership and saved inventory keys remain Snake-specific.

This is not a claim that every object and animation is visually identical:

- Raised board and reserve pieces require Snake-specific collision-safe weapon parking. Source rack sizes match Ludo, but final automatic fit scales/positions can differ to stay on-table and avoid obstacles.
- Snake/ladder traversal and Snake-specific capture routes remain its own gameplay animations. Common dice throw and firearm camera presentation are shared.
- Snake keeps its 750 ms gameplay dice-read pacing while using Ludo's 1500 ms camera result hold. Ludo's frame-quality-dependent action-duration scaling is not copied into Snake's gameplay clock.
- Rendering-quality preset/ownership menus retain their game-specific choices; the common layout and controls match.

## Verification

- `npm run test:snake --prefix webapp`: 156 tests passed across 19 files, including real component mount/control/recovery, gameplay, dice/rig, camera, inventory and weapon placement tests.
- 41 Node tests passed across Ludo gameplay/rules/dice/token, scene/camera parity and whole-module binding audits.
- Golden camera tests compare extracted common pose equations against original Ludo equations; real skinned-rig tests exercise the shared pose/dice contact.
- Whole-module binding audits include Snake page/renderer and new shared helpers, guarding against missing-import startup crashes.
- Independent code review found no concrete runtime regression; extracted Ludo pose/helper functions were compared to the original and are byte-identical.
- Additional server/game Jest run: 19 tests passed; 3 lobby/seating tests failed because bot dependencies are absent (`telegraf` module not found), so server startup coverage is blocked in this checkout.
- `git diff --check` clean.
- Vite production compilation passed on the final code (2m 58s), with existing large-chunk/url-map warnings. This bypasses unrelated full external-asset vendoring/download generation and is not the complete release pipeline.

Visual side-by-side WebGL/device testing has not been completed. Existing cloud browser access could not reach local Vite, and its production browser reports WebGL unavailable; code/geometry tests are not visual acceptance.
