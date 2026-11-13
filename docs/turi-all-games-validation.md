# Turi across the Games page

The existing Tirana Streets player at `/assets/tirana-streets/players/turi.glb`
is reused across every other entry in `gamesCatalog.js`. The binary is unchanged;
the original photographic face, lean build, black clothing and UÇK atlas remain.
No new model licence or replacement avatar is introduced.

| Game | Integration |
| --- | --- |
| Tirana Streets | Existing Turi selection retained. |
| Pool Royale | Turi in the local A/B seat, existing cue/bridge solver and fitted eye sockets. |
| Snooker Royal | Turi in the local A/B seat, existing shot and broadcast-camera flow. |
| Chess Battle Royal | Free default/selection, seated rig, skin-weighted first-person arms. |
| Checkers Battle Royal | Local seated Turi, physical piece interaction and first-person arms. |
| 4 in a Row | Local seated Turi using the shared board actor and chip interaction. |
| Ludo Battle Royal | Free default/selection, seated pose and dice/action overlays. |
| Snake & Ladder | Local eye-camera seat uses Turi and existing dice/token interactions. |
| Domino Royal 3D | Turi follows the actual local seat, including online seats 1–4. |
| Murlan Royale | Free default/selection with existing card/knock actions. |
| Texas Hold’em | Local seated Turi with existing card/table actions. |
| Air Hockey | Original Turi body with mallet palm contact, rail support, planted feet and camera head masking. |
| Tennis Royal | Local online/offline seat uses Turi with mapped Mixamo joints and existing racket IK. |
| Table Tennis Royal | Free default/selection, paddle animation and server character allowlist. |
| Racing Royal | Turi in the local kart and garage, seated steering/pedal IK and camera head masking. |
| Jet Ski Royal | Human racers use Turi with handlebar contacts, crash and remount poses. |

Saved non-default choices remain selectable. Numeric board/card roster indices
are retained by appending Turi and migrating previous defaults explicitly. Player
names, profile avatars, matchmaking and stakes are separate from the 3D model.

The hidden `shared-player-character` download pack contains the same Turi URL.
Every Games-page pack depends on it; another game does not need the Tirana city
pack to obtain its player. The model remains included in native builds.

## Validation

- 26 combined Turi asset/rig/selection/material/download tests and the Table
  Tennis Socket.IO test pass. Tests load the actual GLB with headless texture
  stubs; browser image decoding and rendered appearance are not asserted.
- Additional board regressions pass: Snake 100, Four-in-Row 30, Chess/Checkers
  interaction 15, Chess inventory 7, card regressions 36.
- Billiards targeted rig/camera tests pass (30); the broader suite passes 26/27.
- Racing/Jet Ski targeted Vitest checks pass (9), and manual-driving tests pass (7).
- Shared download/app-pack regressions and Air Hockey checks pass (25).
- Tennis, Table Tennis, Jet Ski and the Air Hockey adapter TypeScript checks pass.
- Full Vite production bundling passes. This verifies application compilation;
  the complete prebuild asset-vendoring/deployment pipeline was not rerun.

## Known verification limits

- Chromium could not start: `process_singleton_posix.cc` reported
  `socket() failed: Operation not permitted`. Phone/portrait visual validation,
  rendered clothing/skin appearance, animation polish and device FPS still need
  a playable browser/device check. No new inline preview or deployment is claimed.
- `poolRoyalAddressLighting.node.mjs:33` fails on unchanged main as well: its old
  `cueBlend: 1` expectation reads `.blend` from the current resolver's `null`.
- Kart's broad TypeScript project still reports pre-existing missing declaration
  files in Tirana modules; no errors were reported in the changed kart files.
- Jet Ski retains its existing first-person policy of hiding the whole rider;
  Turi's body/hands are visible in chase view.
- Existing large-bundle warnings remain. Turi's roughly 12 MB model is shared,
  but no startup-time or FPS improvement is claimed.
