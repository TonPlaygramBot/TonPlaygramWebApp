# Snooker Royal camera and touch controls

Prepared against `main` at `73489404d997579121388f3274a5df093947fae8`.

The requested three-day reference is the September 11 main state,
`b2842f3400f2031bb81bbdcac670c60dfa27b9f4`. Its eleven camera functions
and shared player/shot-camera modules already matched the current camera
logic; the only camera-function text difference was a comment. Those eleven
functions are now pinned byte-for-byte to September 11 in the existing
camera fixture. This preserves the established player-eye, broadcast,
pocket, overhead and replay transitions.

Ball-in-hand now temporarily uses the existing overhead view for the local
player, then restores the previous camera mode, bounds, radius, angle,
focus, FOV and blend. Placement cannot supply an animated-eye view.
Both human characters increase uniformly from 1.60 to 1.68 cue lengths
(5%) while retaining their floor anchor and existing pose/eye-camera logic.

Spin selection keeps the same direction on the cue-ball control regardless
of camera angle. Its centre applies zero added spin. Normalization is
idempotent, and the progressive response curve is applied once at the
physics boundary. Releasing the control no longer snaps to a different
ring/direction; its hit area stays fixed. Cancellation restores the prior
selection. Strike clearance tests use the ball's rear hemisphere and
vertical top/back offset, with physical ball/cushion checks retained.

Ball-in-hand projects onto the rendered ball-centre plane through the
table's actual transform. Its D radius comes from the uploaded table's
colour spots. A touch can grab the ball or select a new location; overlapping
positions move to a nearby legal spot. Confirmation requires a valid
primary-pointer release on the local player's turn. Cancellation, lost
capture and release outside the canvas leave placement pending. An initial
preview position is not a confirmed placement, and firing cannot bypass it.

## Validation and review

- `node --test test/snookerControls.node.mjs test/snookerUploadedTable.node.mjs test/snookerCharacterCamera.node.mjs`
  covers spin directions/strength, repeated normalization, real cushion
  mapping, four portrait projection scales, touch ownership/cancellation,
  overlaps, camera restoration, real-character height and camera baseline.
- Focused Jest checks cover actual slider-to-impulse release, placement
  shooting guards, physics timing, table specs, match state and deciding black.
- Strict TypeScript checks cover the new placement module and the
  React/Three.js preview. The actual Snooker game entry passes a Vite
  production build; its existing large-chunk warning remains.
- `node scripts/build-snooker-character-preview.mjs /workspace/snooker-royal-controls.html`
  builds the in-chat character and controls review. It uses the real
  character and production helpers with a simple inspection table/camera;
  it is not the complete game or a full physics playtest.

The cloud browser rejects the local full-game preview with
`net::ERR_BLOCKED_BY_CLIENT`. Interactive full-game rendering, physical
portrait-phone feel and two-client online play remain unverified.
Review `/snooker-review.html` on a phone: aim and shoot with high/low/side
spin, orbit without changing selection, scratch and place inside the D,
cancel a drag, then confirm and check the return to the previous view.
