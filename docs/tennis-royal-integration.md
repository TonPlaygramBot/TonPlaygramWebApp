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

This is a tuned game AI policy, not a newly trained neural model. A reproducible 30-seed benchmark uses an assisted reference player hitting right at 55% power every 1.25 seconds. With the corrected bounce response, Club/Tour/Pro win 0/27/30 matches respectively. This is a regression/calibration fixture, not a claim about win rates against real players.

## Ball contact and point transitions

`physics.ts` advances the ball to the exact floor or net contact, applies the physical response, then lets the match engine adjudicate it. Legal landings, out balls, second bounces and double faults all rebound. A scoring decision no longer sets velocity to zero. A first service fault or let enters a 1.55-second `fault` phase so the rebound remains visible before the next serve. Swings during toss, faults, point breaks and reviews cannot queue a later shot. A serve that escapes the play area before landing counts as a fault instead of awarding an immediate point.

Hard, clay and grass use different rebound, sliding and rolling responses. Horizontal grip preserves the incoming heading; vertical restitution and bounded spin control the rebound. Repeated contacts lose energy and eventually settle into rolling friction. Exact ground intersections and processing the remaining step prevent fast balls tunnelling through the court or small bounces sinking below it. A net strike deflects the ball back and lets it fall and bounce; a legal net-cord serve repeats the same serve attempt.

Line reviews intentionally pause the saved live rebound while showing the recorded contact. After the review, ball motion resumes without awarding another point. Both online seats receive the same physical state. After a completed online match, the server continues the final ball motion behind the result panel; winner and settlement remain final.

## Television-style line review

`court.ts` owns painted line extents, circle/rectangle contact (including corners), exact ground-intersection time and the replay trajectory. Court dimensions use the outer paint edge, and line contact counts as inside, following Rules 1 and 12 of the [2026 ITF Rules of Tennis](https://www.itftennis.com/media/7221/2026-rules-of-tennis-english.pdf). The live ball is enlarged to 0.12 m radius for visibility, but calls and the magnified replay use a 0.0335 m contact radius. Contact with a line is IN; a footprint that misses it is OUT. This is the game's deterministic footprint model, not a claim of real camera tracking or deformable-ball measurement.

A first bounce within 0.18 m of the contact boundary records its actual impact velocity, position and rebound. Legal rallies continue; after the point, a 4.4-second review shows the final approach at quarter speed, then a top-down ball mark with IN/OUT and distance in millimetres. Near-line first faults are reviewed before the second serve. The review uses recorded physics, including surface restitution, and never re-awards a score.

Online snapshots carry the same review for both seats. The authoritative clock pauses live play, consumes stray swing IDs during the review and resumes automatically. Match-winning reviews finish before normal settlement; leaving during a final review preserves the already-decided winner and settles once. Disconnects retain the existing account/room rules.

`shared/tennis/{court,physics,ai,engine,career,swipe}.ts` are canonical. Run `node scripts/buildTennisEngine.mjs` after editing them and commit the generated JavaScript consumed by Node and Vite.

`node scripts/buildTennisPreview.mjs /workspace/tennis-bounce-fixed.html` builds a playable conversation fragment from the actual game, renderer and engine. It embeds the existing reduced Quaternius meshes and uses in-memory AI/career services. The full app retains its full meshes and account/online services.

## Validation

### Portrait play and feedback update

The match HUD labels sets/games/points, contains long player names, and offers a direct stroke selector with descriptions. Contextual cues distinguish serving, receiving, queued strokes and recovery. Match/break/set-point labels reuse `awardPoint` on a cloned score, including deuce and tie-breaks. A translucent guide highlights the opposite service box; disabling coaching hides the guide and cues. Shot direction and camera projection retain the existing shared-engine rules.

The pause panel exposes auto movement, coaching, sound and battery saver. Battery saver reduces pixel ratio and disables real-time shadows. Idle/paused rendering is limited to 30 fps; hidden pages stop drawing, cancel gestures and pause local matches. Online synchronization remains server-authoritative. Additional touches cancel the active stroke, and pause/background/context loss clear pointer state. Graphics context interruption pauses local play. Athletes finish loading before a match starts, and load errors are reported once.

Point audio uses the connected player's seat. Audio resumes during the input gesture before decoding samples, and mute fades the master gain to silence currently playing sounds. The result panel shows points won, shots hit and the best rally, deduplicating event IDs across repeated snapshots. Online shot/point counts are scoped to the current joined session. Leaving a running match requires an in-game confirmation; dialogs contain keyboard focus.

This update passed all 42 tennis tests (37 existing, five new in `test/tennisFeedback.test.mjs`), the strict tennis TypeScript check, conversation bundling, and Vite application compilation. The full `npm --prefix webapp run build` pipeline could not complete because the disk-constrained sparse checkout omits unrelated Tirana assets required by its prebuild step. Direct Vite compilation is not a complete asset package and was not deployed.

Browser visual QA was blocked by the cloud browser's URL security policy and local server isolation. No browser, physical-phone touch, GPU-performance, or device-audio pass is claimed for this update. `scripts/checkTennisBrowser.mjs` was updated for the direct stroke menu but remains to be run in a browser-enabled environment. Before merging, check 320/390/480 px portrait layouts, serving, every stroke, interrupted two-finger gestures, pause toggles, rematch and both online seats. The existing staging checks below still apply.

Run the new cases with `node --test test/tennisFeedback.test.mjs` alongside the existing suite below.

### Earlier bounce update validation

- `npx tsc -p tsconfig.tennis.json`
- `node --test test/tennisRoyalIntegration.test.mjs test/tennisRoyalSocket.test.mjs test/tennisSwipe.test.mjs test/tennisLineReview.test.mjs test/tennisPlayerView.test.mjs test/tennisBounce.test.mjs`
- `node scripts/checkTennisBrowser.mjs` (install Chromium with Playwright first, or set `TENNIS_BROWSER_EXECUTABLE`; set `TENNIS_BROWSER_OUTPUT_DIR` to retain screenshots and contact traces)
- `npx jest test/onlineGamePolicy.test.js test/tpgGameContracts.test.js test/simpleOnlineFlow.test.js --runInBand`
- `npm --prefix webapp run build`

These cover the actual tennis service and Socket.IO transport, engine completion, stake accounting, replay protection, input/seat restrictions, reconnects, timeout refunds, cancellation during reservation, and career persistence. Stake unit tests use the repository's isolated memory user store; production MongoDB transactions need the staging check below.

All 37 tennis tests, the strict tennis TypeScript check and the full webapp Vite build passed. The regression loop includes 108 complete physical trajectories across three courts, four step sizes, three speeds and three spins, plus 180 seeded matches (90 AI calibration matches and 90 with varied stroke timing, type, power and aim). It checks contact energy loss, heading preservation, settling, score-once behavior, faults, lets, airborne point endings, review resumption and matching online rebounds through final settlement. Existing swipe, camera, account and replay checks remain in the suite.

The browser loop bundles the actual React/Three game with a test-only state probe, serves its existing assets through Playwright request interception, and checks 24 visible landing cases across courts and seats. It also checks real pointer input at 320/390/480 px portrait widths, taps versus fast swipes, pause/resume, canceled gestures, stroke selection, line review and rematch. Chromium 149 with SwiftShader passed these checks. No game JavaScript errors occurred; Google Fonts was unavailable in the test environment, so screenshots use the existing fallback fonts. The probe is not included in the production build. Physical touch feel, device audio and hardware performance still need a phone playtest.

The monolithic `allGamesOnlineMatchmaking` server test could not start in this workspace because the repository's native `canvas` module was unavailable; rebuilding it failed in node-gyp header extraction. No test bypass or production dependency change was added.

Before merging/deploying, use two staging TPC accounts with test balances: choose identical stake/court/length, verify simultaneous start and matching state, finish or retire one match, check one reservation per player and one winner payout, reconnect a phone, cancel an unstarted queue, and confirm career progress after reopening. Also verify 360px phone touch layout and physical-device audio/performance. Existing live stakes were not used during this work.
