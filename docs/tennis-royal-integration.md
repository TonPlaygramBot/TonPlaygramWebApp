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

The playable game is ported from the Tennis Royal prototype: Three.js court, animated Kenney Mini Characters, Kenney Impact Sounds, synthesized crowd/fanfare, and software rendering fallback. Both Kenney packs are CC0; licenses are in `shared/tennis`. Character geometry, six retained animations, palette textures and sounds are embedded in the lazy-loaded game bundle. No new runtime package dependencies were added.

`shared/tennis/engine.ts` and `career.ts` are the canonical shared sources. Run `node scripts/buildTennisEngine.mjs` after editing them, and commit the generated `.js` files consumed by Node and Vite.

## Validation

- `npx tsc -p tsconfig.tennis.json`
- `node --test test/tennisRoyalIntegration.test.mjs test/tennisRoyalSocket.test.mjs`
- `npx jest test/onlineGamePolicy.test.js test/tpgGameContracts.test.js test/simpleOnlineFlow.test.js --runInBand`
- `npm --prefix webapp run build`

These cover the actual tennis service and Socket.IO transport, engine completion, stake accounting, replay protection, input/seat restrictions, reconnects, timeout refunds, cancellation during reservation, and career persistence. Stake unit tests use the repository's isolated memory user store; production MongoDB transactions need the staging check below.

The monolithic `allGamesOnlineMatchmaking` server test could not start in this workspace because the repository's native `canvas` module was unavailable; rebuilding it failed in node-gyp header extraction. No test bypass or production dependency change was added.

Before merging/deploying, use two staging TPC accounts with test balances: choose identical stake/court/length, verify simultaneous start and matching state, finish or retire one match, check one reservation per player and one winner payout, reconnect a phone, cancel an unstarted queue, and confirm career progress after reopening. Also verify 360px phone touch layout and physical-device audio/performance. Existing live stakes were not used during this work.
