# Tennis Royal integration

Entry: `/games/tennisroyal/lobby`; playable route: `/games/tennisroyal`.

The Games catalog and shared lobby header use the included Tennis Royal thumbnail. The portrait lobby offers free AI exhibition, account-saved career, and online same-stake matchmaking. It reuses `RoomSelector` with TPG only and `runSimpleOnlineFlow`: register the TPC account, request a seat, confirm readiness, and navigate both clients from the authoritative `gameStart` payload. No separate website, iframe, anonymous cookie profile, or room-code API is required.

## Match contract

- Game type `tennisroyal`, exactly two TPC account seats, positive integer TPG stake.
- Match partitions: stake, court (`hard`, `clay`, `grass`) and length (`quick`, `set`, `full`).
- `tennisJoin` validates membership and assigns the camera seat. Reconnecting restores that original seat, and replaces the older socket.
- `tennisInput` accepts controls only. The shared tennis engine advances on the server; clients cannot submit scores, winners, or career upgrades to online matches.
- The game waits for both courts to load. A connection becomes stale at 12 seconds; after a 60-second grace, a sole connected player wins. Both absent players receive refunds. Explicit departure is retirement.
- `TennisMatch` reserves both stakes in one MongoDB transaction before game start. Settlement credits the two-player pot to the winner, or refunds each stake on cancellation. Terminal match status and unique transaction IDs prevent repeated payouts. MongoDB must support transactions, as required by the existing Chess stake flow.
- Pending settlements retry. Contracts expire after two hours; an expiry sweep refunds leftover contracts, including after a server restart. Match simulation follows the existing process-local Socket.IO architecture and is not durable across server restarts; deploy with the same single match-owner/sticky-session constraints as the other in-memory games.
- `TennisCareer` stores account-bound progression with revision checks and active-match result IDs. Career skill points are separate from wallet TPG and never produce wallet payouts. Solo wins remain casual client-reported results.

## Assets and source

The game uses React, TypeScript and Three.js with two rigged **Quaternius Universal Base Characters** athletes. These replace the Kenney Mini Characters. The optimized male/female meshes and hair are reused from `webapp/public/assets/table-tennis/athlete-{male,female}.glb`; their CC0 license and original provenance remain in that directory's `Quaternius-LICENSE.txt` and `CREDITS.md`. Source: https://quaternius.com/packs/universalbasecharacters.html . These are anatomical game characters, not photorealistic scans. Tennis adds opaque, smoothed clothing shells, sports-kit colors, articulated running/ready/serve/stroke poses, hand-anchored rackets, and head-attached hair. No paid or Ready Player Me assets are used by tennis.

The stadium includes instanced seating and spectators, concrete tiers and aisles, drainage, windscreens, courtside benches, an umpire chair and floodlights. The court retains regulation dimensions and uses deterministic surface-specific acrylic, clay and grass textures, a dark mesh net with centre strap, soft shadows and a seamed ball. The closest end stand and windscreen/fence are hidden for each camera seat to preserve visibility. Texture generation is cached per surface. Software rendering retains athlete/seat colors and omits spectators to reduce CPU work.

Kenney Impact Sounds remain embedded; their CC0 license is in `shared/tennis`. Crowd and fanfare are synthesized. Character binaries are loaded from the app's own assets. No runtime dependencies were added.

## Player camera and swipe controls

The low third-person camera sits behind the player at 4.8 m elevation, with 64° vertical field of view and smooth lateral/depth following. It keeps the player's body visible on 320–480 px phones and preserves screen axes for either online seat. The near fence is hidden so it cannot obstruct this closer camera.

Power and direction come from the last 120 ms of pointer movement, measured in court-screen widths per second. CSS coordinates and timestamp interpolation make equivalent gestures consistent across phone widths, pixel ratios and sparse/coalesced events. A stationary tap/hold is 10% power; a fast flick reaches 100%. Holding does not charge power. The stroke badge separately selects drive, topspin, slice or lob.

The camera projection converts the finger's movement vector into a unit court direction. Starting or releasing on a different part of the screen does not change that direction. Diagonal and sideways gestures retain their angle; a backwards gesture is not forced toward the opponent. Swipe toward the opponent and angle left/right to steer. A tap without direction makes a soft central return or a diagonal serve. Assisted movement follows the interception point, so swiping no longer drags the player away from the ball. Manual movement remains available through the existing input contract.

The engine snapshots each queued shot's direction, power and spin, including serves, so subsequent input does not overwrite a released shot. Invalid/nonfinite directions are discarded and valid directions normalized on the server. Human placement has no random error. Power changes actual ball pace and depth; arcs retain net clearance for soft returns. Canceled/lost pointers, extra touches, pause and backgrounding do not release a shot.

## Pro AI

Exhibitions and the conversation preview default to Pro; Club and Tour remain selectable and career retains its progression. The deterministic opponent predicts reachable contact points through a surface-specific bounce, has level-specific reaction intervals and movement speeds, waits for a useful contact height, recovers according to court position, attacks open space and sometimes plays behind a recovering opponent. It selects a lob against a net player, a drop against a deep player, and safer strokes under pressure. It never teleports or awards itself points.

This is a tuned game AI policy, not a newly trained neural model. A reproducible 30-seed benchmark uses an assisted reference player hitting right at 55% power every 1.25 seconds. Club/Tour/Pro win 4/28/30 matches respectively. This is a regression/calibration fixture, not a claim about win rates against real players.

## Television-style line review

`court.ts` owns painted line extents, circle/rectangle contact (including corners), exact ground-intersection time and the replay trajectory. Court dimensions use the outer paint edge, and line contact counts as inside, following Rules 1 and 12 of the [2026 ITF Rules of Tennis](https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf). The live ball is enlarged to 0.12 m radius for visibility, but calls and the magnified replay use a 0.0335 m contact radius. Contact with a line is IN; a footprint that misses it is OUT. This is the game's deterministic footprint model, not a claim of real camera tracking or deformable-ball measurement.

A first bounce within 0.18 m of the contact boundary records its actual impact velocity, position and rebound. Legal rallies continue; after the point, a 4.4-second review shows the final approach at quarter speed, then a top-down ball mark with IN/OUT and distance in millimetres. Near-line first faults are reviewed before the second serve. The review uses recorded physics, including surface restitution, and never re-awards a score.

Online snapshots carry the same review for both seats. The authoritative clock pauses live play, consumes stray swing IDs during the review and resumes automatically. Match-winning reviews finish before normal settlement; leaving during a final review preserves the already-decided winner and settles once. Disconnects retain the existing account/room rules.

`shared/tennis/{court,ai,engine,career,swipe}.ts` are canonical. Run `node scripts/buildTennisEngine.mjs` after editing them and commit the generated JavaScript consumed by Node and Vite.

`node scripts/buildTennisPreview.mjs /workspace/tennis-player-view.html` builds a playable conversation fragment from the actual game, renderer and engine. It embeds the existing reduced Quaternius meshes and uses in-memory AI/career services. The full app retains its full meshes and account/online services.

## Validation

- `npx tsc -p tsconfig.tennis.json`
- `node --test test/tennisRoyalIntegration.test.mjs test/tennisRoyalSocket.test.mjs test/tennisSwipe.test.mjs test/tennisLineReview.test.mjs test/tennisPlayerView.test.mjs`
- `npx jest test/onlineGamePolicy.test.js test/tpgGameContracts.test.js test/simpleOnlineFlow.test.js --runInBand`
- `npm --prefix webapp run build`

These cover the actual tennis service and Socket.IO transport, engine completion, stake accounting, replay protection, input/seat restrictions, reconnects, timeout refunds, cancellation during reservation, and career persistence. Stake unit tests use the repository's isolated memory user store; production MongoDB transactions need the staging check below.

All 26 tennis tests, the strict tennis TypeScript check and the full webapp Vite build passed. The tennis regressions cover gesture timing/width invariance, screen-vector angle preservation for both seats, queued input capture, actual speed differences, painted-line/corner contact, fast-ball intersections at multiple time steps, near-line first faults, delayed IN reviews, match-ending reviews and identical online state with one settlement. The AI fixture runs 90 seeded matches. Camera framing is checked at 320/390/480 px widths and multiple portrait heights. The actual game scene and magnified line mark were also rendered offline with the existing software fallback. Hardware WebGL, physical touch feel, audio and performance still need a phone playtest.

The monolithic `allGamesOnlineMatchmaking` server test could not start in this workspace because the repository's native `canvas` module was unavailable; rebuilding it failed in node-gyp header extraction. No test bypass or production dependency change was added.

Before merging/deploying, use two staging TPC accounts with test balances: choose identical stake/court/length, verify simultaneous start and matching state, finish or retire one match, check one reservation per player and one winner payout, reconnect a phone, cancel an unstarted queue, and confirm career progress after reopening. Also verify 360px phone touch layout and physical-device audio/performance. Existing live stakes were not used during this work.
