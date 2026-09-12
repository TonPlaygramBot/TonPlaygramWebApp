# Table Tennis Royal

Portrait React / TypeScript / Three.js game at `/games/tabletennisroyal`, with its own lobby at `/games/tabletennisroyal/lobby` and Games catalog card. The existing Tennis game is unchanged.

## Modes and controls

- Exhibition: three AI levels, best of 1/3/5 games, three geometry-built competition arenas, five bundled player appearances, plus the solo player's already-unlocked shared characters. Saved solo cosmetic choices remain available through Pause. All modes now use the same runtime; `LegacyGame.tsx` is no longer routed.
- Career: five events with three distinct rounds: a sprint starting at 6–6, a comeback starting at 4–8, and a best-of-three championship. Each game still ends at 11 with a two-point margin. Event rally missions increase from 4 to 12 shots and award one skill point once per event, including after a loss. Wins award two points, with the existing event completion bonuses. Account saves retain their current event, round and upgrades; old saves gain an empty medal list. Preview progress is session-only.
- Online: the existing two-player TPC registration, stake selection, queue cancellation and matchmaking flow; arena and match format partition the queue. The server simulates the match and settles stakes. Clients send controls, never results or balances.
- The match has an always-available pause button and a visible swipe trail/power meter. Coalesced touch samples improve tracking on high-refresh devices. Tap for a soft shot; swipe faster for more power. The recent 120 ms of finger velocity controls power independently of screen density, initial touch location and hold duration. The actual camera projection preserves the swipe's screen direction, including diagonals, either seat and changes of ends. A one-finger swipe selects drive or topspin by speed; a fast swipe on a high ball smashes; a two-finger swipe selects backspin without reversing direction. Tap jitter and held touches remain soft.
- During an incoming ball, swiping only aims the shot and assisted footwork stays active. During an outgoing ball, drag to reposition laterally and towards/away from the table; this gesture does not commit another hit. The same camera projection maps movement to the screen; the server confines each player to their own half. Assisted footwork resumes on release; automatic hitting is off by default. Slightly early swipes wait for the legal bounce. Cancelled gestures, lost capture, pause and point transitions cannot fire a held stroke later. Multi-touch commits once after every finger lifts, and three-finger gestures are ignored.
- Tap Pause or use a two-finger tap to open settings. Explicit Resume and Return to lobby controls are available. Tap empty space to resume; swipe down with two fingers while in settings to return to the lobby (online, this retires from the staked match). Sound, automatic hitting and owned appearance choices are available there. After an exhibition match, tap to rematch or two-finger tap for the lobby. Space plays a soft shot; Escape opens/resumes settings. Normal lobby/setup menus retain their controls.
- A two-row broadcast scoreboard shows account usernames, avatars with initials as a fallback, points, games and the serving indicator. Identity stays attached to the seat when ends change. Long usernames truncate without moving score columns. The camera uses the local player’s eye-height perspective; the opponent and net remain visible, with the local character’s actual skinned forearms and hands in the foreground.

## Scale, ball and singles rules

The table is 2.74 × 1.525 m with its playing surface at 0.76 m. The net is 0.1525 m above it; the ball diameter is 40 mm. Human models are normalized to 1.75 m. The camera stays at 1.62 m eye height and follows the player’s position. Its portrait lens retains the full net width at 320, 390 and 480 px without scaling the table or placing the camera above the court. The closest table corners can extend beyond the portrait frame, as expected from player perspective.

`arena.ts` builds a physical floor, competition barriers, tiered seating, walls, roof beams, overhead fixtures and arena signs. Two instanced meshes draw 176 seats. Three color themes reuse the same arena geometry. The active runtime imports no HDR loader and assigns no environment texture. Legacy arena IDs remain compatible with saved choices and online queue metadata; HDR files used by other games are retained.

Character motion restores the earlier serve, forehand and backhand curves with preparation, torso rotation, free-arm balance, wrist motion and follow-through. Anatomical bone binding supports the bundled rigs, avoids matching the opposite arm by substring, and synchronizes separate hair skeletons. Hand targets use the competition geometry while retaining each model’s shoulder anatomy; the corrected anatomical right vector prevents crossed arms. Idle poses no longer use the forehand backswing. Reach is clamped to each arm chain, the serving racket stays forward, palms align with the blade, and racket-hand fingers curl. Paddles remain 11.5 cm from the wrist grip origin. First-person geometry crops the head, torso and upper arms while reusing the actual skinned hands; the opponent uses the full model. Dragging restores manual movement and players turn towards the ball.

The rules follow the [2026 ITTF laws reproduced by Table Tennis England](https://www.tabletennisengland.co.uk/content/uploads/2026/07/Laws-of-Table-Tennis-2026-27.pdf): games to 11 with a two-point margin, two serves each then one at deuce, alternating first server, ends changed between games and at five in the deciding game. The first server is chosen by lot (the local conversation preview starts with the human).

Serves have a vertical, spin-free toss exceeding 16 cm and a descending strike behind the end line; they must bounce on each half in order. Legal net serves are lets, net returns remain playable, and top edges count while vertical sides do not. No second serve or invented 20-second serve penalty. The ten-minute expedite rule applies below 18 combined points, including alternating service and the receiver's 13-return limit. Paddle contact is scheduled after the required bounce, preventing volleys.

The swept ball solver handles table, upper edges, apron, net and floor contacts at 240 Hz. A 30 cm table drop rebounds about 23 cm. Bounces retain motion; dead-ball motion continues after a point and after the match, without scoring or settling again. Spin, racket timing, ball drag and animated body mechanics remain an arcade approximation; doubles, umpire conduct rulings and player-requested early expedite are outside this singles game.

## Architecture

`shared/tabletennis/engine.ts` coordinates the deterministic simulation. `rules.ts` owns scoring/service/ends, `physics.ts` owns collisions, and `swipe.ts` reuses the Tennis Royal velocity sampler. Regenerate their committed JS with `node scripts/buildTableTennisEngine.mjs`. Rendering, arena construction, camera projection, broadcast UI, audio, options and transport are separate modules under `webapp/src/games/tabletennis`; `touch.ts` owns multi-touch classification and `animation.ts` adapts the original skeletal poses.

`bot/services/tabletennisRoyal.js` owns match state, account-bound seats, reconnects and input validation. MongoDB stake reservations and idempotent payouts/refunds live in `tabletennisStake.js`; career revision and completion handling live in `tabletennisCareer.js`. Synthetic development accounts use an in-memory test store. Real accounts require transactional MongoDB, as in Tennis Royal.

Online simulation currently lives in one server process. Disconnects pause play; the reconnect grace period is 60 seconds. A remaining connected player wins on timeout; both absent seats refund. After process loss, persisted unsettled reservations expire/refund after two hours. Multi-instance deployment requires sticky match routing or a shared simulation owner before scaling horizontally.

## Preview and verification

Run normal app development with `npm run dev`, or frontend only with `npm --prefix webapp run dev`. `/table-tennis-preview.html` is the standalone session-only development preview. `node scripts/buildTableTennisPreview.mjs` builds an embedded conversation preview using the checked-in reduced assets. It intentionally has no account, wallet or online transport.

Checks:

```
node --test test/tableTennisEngine.test.mjs test/tableTennisPhysicsRules.test.mjs test/tableTennisLegacyRuntime.test.mjs test/tableTennisRoyalIntegration.test.mjs test/tableTennisRoyalSocket.test.mjs test/tableTennisTouch.test.mjs test/tableTennisPlayerArena.test.mjs
npx tsc -p tsconfig.tabletennis.json
npm --prefix webapp run build
node scripts/checkTableTennisBrowser.mjs
TABLE_TENNIS_PREVIEW_ASSETS=1 node scripts/checkTableTennisBrowser.mjs
TABLE_TENNIS_SOFTWARE=1 node scripts/checkTableTennisBrowser.mjs
```

The 39 automated tests include 228 serve combinations, all four return strokes at three powers, swept fast contacts, net/edge/floor cases, scoring/end changes/expedite, cancellation-safe sampling, fixed timestep determinism and nine complete AI-match configurations. Touch tests cover single-commit multi-touch, held menu gestures, soft tap jitter, cancellation, speed/height-based stroke selection, manual depth validation and assisted movement recovery. Service tests cover stake reservation/settlement/refund idempotency, continued final ball motion, reconnect identity, disconnect expiry, cancellation races and career persistence. The socket test uses two real Socket.IO clients with synthetic balances.

The browser script is available to check the real React/Three game at 320, 390 and 480 px: 96 shot-direction and 96 drag-direction cases, soft tap versus fast swipe, cancellation, two-finger pause/resume/backspin, pause/resume controls, torso/arm animation and paddle grip, local arena geometry without an environment texture, long usernames and avatars, eight rendered bounce/scoring cases, all bundled arenas, character switching and rematch. It can use production assets, reduced conversation assets or the software fallback. Set `TABLE_TENNIS_BROWSER_EXECUTABLE` for a non-default Chromium and `TABLE_TENNIS_BROWSER_OUTPUT_DIR` to retain screenshots/results. Physical iOS/Android touch feel and GPU performance, external owned cosmetic sources, and real-account MongoDB/deployment checks remain staging checks.

Asset credits and the inherited Ready Player Me commercial-permission check are in `webapp/public/assets/table-tennis/CREDITS.md`.

## Player-view upgrade validation (September 2026)

All 39 targeted tests pass, including 96 screen-heading checks across both seats and end changes, the anatomical ready pose, the complete 15-round career and one-time mission rewards. Strict table-tennis TypeScript and the full Vite production build pass (2,755 modules; existing large-chunk warnings). The conversation preview bundles the production React/Three.js code with reduced, packed character assets; it makes no account or wallet calls.

`node scripts/reviewTableTennisScene.mjs <output-directory>` can generate a CPU-only scene review using `@napi-rs/canvas` (or the supplied primary runtime dependency). At 320/390/480 px, the net fits the frame and both paddles remain exactly 0.115 m from the wrist. This is a geometry and compatibility-renderer check, not a GPU/browser performance measurement.

Browser navigation to the local preview was blocked by the environment (`ERR_BLOCKED_BY_CLIENT`), so the updated browser suite was not executed for this upgrade. Physical phone swipe feel, GPU rendering, sound playback and production account storage still need a staging playthrough. The simulation remains an arcade approximation; the power display shows input power, while spin, gravity and net-clearance assistance affect actual ball speed.
