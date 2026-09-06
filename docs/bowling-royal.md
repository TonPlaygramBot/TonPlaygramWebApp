# Bowling Royal

The supplied React/Three.js bowling prototype is integrated into TonPlaygramWebApp.
The Games catalog opens `/games/bowlingroyal/lobby`; the playable route is
`/games/bowlingroyal`. The lobby offers free AI (Club, Tour, Pro) and the existing
same-stake TPG two-player matchmaking flow.

## Gameplay

- Ten frames, strike and spare bonuses, all tenth-frame rack/reset cases, gutter
  balls, ties and a 300-point maximum. Frame totals stay pending until their bonus
  deliveries are known. The scorecard fits five frames per row on portrait phones.
- Swipe visually upward and release to bowl. A longer upward swipe adds power;
  release position sets the target and lateral movement adds hook. Pointer
  cancellation cancels aiming. Coordinates are relative to the actual canvas.
- Keyboard: left/right arrows aim; hold/release Space for power. A Bowl button
  provides a single-action delivery. Free AI matches can pause and restart.
- Cannon-es advances at 120 fixed steps per simulated second. Compound pin bodies,
  contact materials, pin-to-pin collisions and bounded settle time determine the
  result. Gutters are irreversible for that delivery and always finish a turn.
  Automatic approaches stop behind the foul line; there is no foot-foul input.
- The original oak lane, uncovered setup, bowler, glossy balls, pinsetter, ball
  return and tracking camera are retained. Human limbs animate procedurally and
  the held ball follows the loaded right-hand joint. The renderer has bounded
  pixel ratio/shadows, resize cleanup and a software fallback using the same game
  state. Sounds use Web Audio with no runtime audio downloads.

## Existing TPG flow

`RoomSelector` → `runSimpleOnlineFlow` / `joinRoyalLobby` → `seatTable` →
`confirmReady` → authoritative `gameStart` → `bowlingJoin`.

Game type is `bowlingroyal`, two distinct canonical TPG account seats, positive
safe-integer TPG stake. Match metadata is `{format:'tenpin',mode:'online',token:'TPG'}`;
the shared server normalizes stored token casing. Stake and format partition the
queue. No separate account system, simulated online opponent or preview wallet is
introduced.

The server owns physics, scoring, turn changes, winners and settlement. Clients
send only bounded throw controls plus an expected turn number. Repeated delivery
IDs are idempotent; an altered retry, wrong turn, outsider, identity mismatch or
superseded socket cannot throw. Snapshots carry revisions; clients discard stale
responses. Each socket is limited to 40 bowling requests per second.

`bowlingSync` keeps both clients current; reconnect registers the same account and
restores the original seat. Both clients must join before play. A 45-second turn
clock runs only while both connections are live. Connections become stale after
12 seconds; reconnect grace is 60 seconds. An incomplete initial load or both
players absent refunds the match. One absent player after both joined forfeits;
explicit retirement also forfeits. Late lobby cancellation cannot mutate a started
bowling roster. An active bowling account cannot queue into another game.

`BowlingMatch` stores the stake contract. Both balances are reserved atomically in
a MongoDB transaction before start. The winner receives both stakes; a tie refunds
each. Terminal contract status, transaction retries and unique ledger IDs prevent
duplicate charges/payouts. Cancellation during reservation refunds the original
roster. Pending settlement retries preserve the in-memory result. Contract expiry
recovery refunds reservations left after restart (two-hour deadline).

Like the existing tennis service, active simulation and a not-yet-settled result
belong to one Node process. Restart interrupts play and outstanding contracts
eventually refund; this is not durable mid-match recovery. Deploy with one match
owner/sticky routing. The app and bot must be released together.

## Source and preview

Edit `shared/bowling/{engine,scoring}.ts`, then run
`node scripts/buildBowlingEngine.mjs` to refresh the checked-in JavaScript consumed
by Node and Vite. The new root `cannon-es` dependency is the same version already
declared by the web app. No unrelated runtime packages were upgraded.

The standalone AI preview uses the actual game and lobby components:
`npm --prefix webapp exec -- vite build --config webapp/vite.bowling-preview.config.mjs`.
Its output is `webapp/dist-bowling-preview`. Online play is deliberately accessed
through TonPlaygram's registered account/lobby routes, not the static AI preview.
Asset origins and hashes are in `webapp/public/assets/bowling-royal/CREDITS.md` and
`sources.json`.

## Validation and release checks

- `npx tsc -p tsconfig.bowling.json`
- `node --test test/bowlingRoyal.test.mjs test/bowlingRoyalSocket.test.mjs`
- `npx jest test/onlineGamePolicy.test.js test/tpgGameContracts.test.js test/simpleOnlineFlow.test.js --runInBand --forceExit`
- `npm --prefix webapp run build`
- Standalone preview production build.

Bowling tests cover official scoring fixtures, a full AI match and deterministic
replay, actual rigid-body strikes/gutters, screen-direction inputs, queue policy,
ledger replay protection, cancelled starts, identity/seat restrictions, replacement
sockets, turn timeouts, disconnect refunds and settlement retries. A transport test
uses two real Socket.IO clients. Ledger unit tests use synthetic memory accounts.

Before releasing real TPG stakes, run
`BOWLING_TEST_MONGO_URI=<disposable-replica-set> node --test test/bowlingStakeMongo.test.mjs`.
The test checks real transaction rollback, concurrent reservations and settlement.
Also verify two staging accounts through the actual Games → lobby → match flow,
reconnect a phone, complete and retire a match, and check ledger entries once each.

The existing `test/allGamesOnlineMatchmaking.test.js` could not start here because
the bot's native `canvas.node` is absent. Rebuilding canvas failed (Node 24 binary
unavailable, header extraction/native build prerequisites unavailable). No fake
binding or production dependency bypass was introduced. Real-device WebGL, touch,
audio, FPS/thermal and cross-network testing remain release checks; browser visual
testing was not performed in this task.
