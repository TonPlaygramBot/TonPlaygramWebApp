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

The stadium includes instanced seating and spectators, concrete tiers and aisles, drainage, windscreens, courtside benches, an umpire chair and floodlights. The court retains regulation dimensions and uses deterministic surface-specific acrylic, clay and grass textures, a dark mesh net with centre strap, soft shadows and a seamed ball. The closest end stand is hidden for each camera seat to preserve visibility. Texture generation is cached per surface. Software rendering retains athlete/seat colors and omits spectators to reduce CPU work.

Kenney Impact Sounds remain embedded; their CC0 license is in `shared/tennis`. Crowd and fanfare are synthesized. Character binaries are loaded from the app's own assets. No runtime dependencies were added.

## Swipe controls

Shot power comes from the last 120 ms of pointer movement, measured in court-screen widths per second. CSS coordinates make the response independent of device pixel ratio; interpolation handles sparse/coalesced pointer events. A stationary hold stays at 20% power, while a quick flick reaches 100%. Released power remains visible on the HUD. Canceled/lost pointers, secondary touches, pause and backgrounding do not release a shot.

Release position continuously aims visually left/right, mapped for either camera seat. Swipe visually up for topspin, down for slice, or level for a drive; a long, slow upward gesture produces a lob. A fast upward flick stays topspin. Each stroke and serve varies flight time with power in the shared authoritative engine, so increased power actually increases ball pace. The existing serve capture, input clamping, collision rules and 120 Hz simulation remain in effect.

`shared/tennis/engine.ts`, `career.ts` and `swipe.ts` are the canonical shared sources. Run `node scripts/buildTennisEngine.mjs` after editing them, and commit the generated `.js` files consumed by Node and Vite.

`node scripts/buildTennisPreview.mjs` builds a playable conversation fragment at `/workspace/tennis-royal.html`, using the same game, renderer, rig and gesture logic. It embeds the app's existing reduced Quaternius preview meshes and uses in-memory AI/career services. The normal app continues to load the full athlete meshes and its account/online services.

## Validation

- `npx tsc -p tsconfig.tennis.json`
- `node --test test/tennisRoyalIntegration.test.mjs test/tennisRoyalSocket.test.mjs test/tennisSwipe.test.mjs`
- `npx jest test/onlineGamePolicy.test.js test/tpgGameContracts.test.js test/simpleOnlineFlow.test.js --runInBand`
- `npm --prefix webapp run build`

These cover the actual tennis service and Socket.IO transport, engine completion, stake accounting, replay protection, input/seat restrictions, reconnects, timeout refunds, cancellation during reservation, and career persistence. Stake unit tests use the repository's isolated memory user store; production MongoDB transactions need the staging check below.

Swipe regressions also verify equal-distance fast/slow gestures, stationary holds and pauses, flicks after holding, screen-size and sampling-rate equivalence, noisy timestamps, screen-relative aiming for both seats, and increased ball pace with legal first bounces for every stroke and serve. The September 7 upgrade passed all 13 tennis tests, the tennis TypeScript check, and the full webapp build. Athlete skeletal/garment geometry was inspected offline; physical-device visual performance remains a staging check.

The monolithic `allGamesOnlineMatchmaking` server test could not start in this workspace because the repository's native `canvas` module was unavailable; rebuilding it failed in node-gyp header extraction. No test bypass or production dependency change was added.

Before merging/deploying, use two staging TPC accounts with test balances: choose identical stake/court/length, verify simultaneous start and matching state, finish or retire one match, check one reservation per player and one winner payout, reconnect a phone, cancel an unstarted queue, and confirm career progress after reopening. Also verify 360px phone touch layout and physical-device audio/performance. Existing live stakes were not used during this work.
