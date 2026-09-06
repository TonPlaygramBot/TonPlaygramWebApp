# Kart Royale

Kart Royale adds a dedicated portrait-first 3D racing game to TonPlaygram's games
catalog at `/games/kartroyale/lobby` (also available at `/games/kartroyale`).

## Play

- **VS AI:** six racers, three circuits, Rookie / Street / Pro opponents.
- **Career:** Rookie, Street and Royale cups. Finish top three in the first two
  cups and first in the finale. Wins unlock the next cup; the first completion
  awards achievement credits. Progress and best times are saved on this device.
- **TPG Multiplayer:** choose a stake, circuit and grid of 2–6 human racers in
  the dedicated garage lobby. Quick Match uses the shared Royal queue; Private
  Room uses a shared 4–8-character code and identical criteria. A full ready grid
  starts together. AI and career remain free, and bots never take TPG seats.

Auto throttle starts after the countdown. Touch the left/right buttons to steer,
BRAKE to slow down, hold DRIFT while steering then release for turbo, or hold
BOOST on a straight. Keyboard: arrows or A/D, down/S, Space, Shift. Left always
turns visually left from the chase camera. Portrait is never rotated.

## Implementation

React + TypeScript owns the lobby, race HUD, menus and career state. The Three.js
renderer uses local GLB karts, PBR materials, environment lighting, a bounded
shadow map and instanced road furniture. Opponents use a lower-detail GLB. The
adaptive setting reduces pixel ratio under load; performance mode disables
shadows. The FPS display reports measured rendering performance, not a promise
of a particular frame rate on every device. Rendering is independent of React
updates; the HUD updates about ten times per second. Resources and listeners
are disposed when leaving the game.

`simulation.mjs` is dependency-free and shared with `bot/services/kartRoyale.js`.
The game loop runs physics and AI at a fixed 60 Hz. Progressive steering, speed-dependent turn response, tire scrub, braking grip, and engine/drag forces replace instant steering and linear throttle response. Multiplayer clients send
bounded inputs at 30 Hz and receive room snapshots at approximately 20 Hz. The
server calculates movement, collision response, ordered lap checkpoints, race
time and standings. Client position/lap/score fields are ignored. Rendering
interpolates remote snapshots and predicts the local vehicle.

The server is attached to the existing authenticated Socket.IO connection. It
issues a private reconnect token in the joining client's acknowledgement and
never includes tokens in room broadcasts. Reconnect has a 15-second grace
period. Disconnected waiting players are removed and host ownership transfers.
Empty and expired rooms are collected. The race has a four-minute limit.

### Shared TPG matchmaking

`KartRoyaleMatchmaking.jsx` uses `RoomSelector` (TPG only) and
`runSimpleOnlineFlow` / `joinRoyalLobby`, the same helpers used by the other
Royal games. The Games card links to `/games/kartroyale/lobby`; the garage contains
the matchmaking controls alongside AI and career. `onlineGamePolicy.js` and the
frontend readiness map register `kartroyale` with 2–6 seats and validated circuits.

The shared flow registers the canonical TPG account, sends `seatTable`, displays
`lobbyUpdate`, confirms readiness, and waits for `gameStart`. Queue partitions are
game, TPG stake, circuit and grid size. Paint and display name do not partition a
queue. Hosted codes stay outside public matching. Cancels and late seat replies
send `leaveLobby`; reservation failures clear the queue with a visible error.

After `gameStart`, `kart:match` binds the existing account to its server-created
grid, returns a private session token, and saves `tableId`/`accountId` in session
storage. All clients must join before the countdown; the load deadline is 30
seconds. Reconnect requires both the registered account and session token. A
late lobby cancel cannot mutate a started race's roster or release its stake.

`kartStake.js` reserves all human stakes atomically in the existing User balance
and transaction ledger when the grid locks, with a durable `KartMatch` record.
It requires MongoDB transactions (a replica set, as used by the chess contract).
There is no client-side debit or payout endpoint. The first server-verified
finisher receives the full pot, with no new house fee. An incomplete start or
a race without a finisher or an exact dead heat refunds all stakes. Leaving during racing forfeits
the seat; a valid finisher can still win. Payout/refund receipts appear in the
results screen. Every new race requires explicitly joining a new TPG queue.

Settlement retries reuse the frozen server result and unique transaction IDs.
The database transaction prevents partial reservation/payout, negative balances,
duplicate charges and duplicate payouts. Expired contracts are refunded by a
minute sweeper after their ten-minute deadline, including after a process restart.
No funds are reserved while waiting for opponents, so queue cancellation needs
no compensating client refund. Standalone/free legacy rooms are isolated from
the TPG grid and cannot add AI or unseated accounts to it.

Run one authoritative game-server process for this initial version. Room state
is in memory and a server restart ends active races; the persistent TPG recovery
sweeper refunds their expired contracts. Scaling requires shared
room ownership and routing players to the owning simulation; adding a broadcast
adapter alone is insufficient. Career saves are device-local, not account sync.

## Assets

The kart is adapted from **Scaranto's CC0 mechanical kart**, with an exposed
chassis, steering linkage, engine and cables. It adds smooth tires, metal and
clearcoat finishes, a helmeted driver, and named wheel/steering pivots. Rotating
wheels, front-wheel steering, steering-wheel movement, restrained chassis flex,
acceleration/braking pitch and rear-tire marks follow the shared simulation.

The city uses two **Quaternius Downtown City MegaKit (CC0)** buildings with brick,
trim, roof and normal/roughness maps. Nearby buildings use 12,334 / 19,642-triangle
templates; distant versions use 3,929 / 5,239. Each template's material primitives
are instanced, with high detail within 64 m and distance culling at 250 m.
Performance mode uses only lower detail and a 180 m range. Canyon cliffs use
irregular rock geometry. **Poly Haven Asphalt 02 (CC0)** supplies local 1K diffuse,
OpenGL normal and roughness maps with world-scale UVs. Textures are shared across
instances and disposed when leaving the game. There is no runtime asset CDN.

Original asset pages, creator credits, source hashes, and the pinned unmodified
building mirror are recorded in `webapp/scripts/kart-royale-sources.json` and
`webapp/public/assets/kart-royale/ATTRIBUTION.md`. Credits are also visible in the
game settings. The existing engine recording remains unchanged.

Optional regeneration (ordinary app builds use the checked-in runtime assets):

```sh
node webapp/scripts/fetch-kart-royale-sources.mjs /tmp/kart-royale-sources
node webapp/scripts/build-kart-royale-assets.mjs /tmp/kart-royale-sources/scaranto-kart.glb
node webapp/scripts/build-kart-royale-city.mjs /tmp/kart-royale-sources/city /tmp/kart-royale-sources
```

The source downloader verifies byte sizes and SHA-256 checksums. The generators
use the repository's Three.js, sharp and meshoptimizer installation. Derived
GLBs remain CC0 for source geometry; TonPlaygram additions follow the repository's
existing terms. The featured Games-page card links directly to the racing lobby
and displays AI, multiplayer and career modes.

## Verification and preview

```sh
node --test test/kartRoyale.test.mjs
node --test test/kartTpgMatchmaking.test.mjs test/kartStake.test.mjs
npx jest test/simpleOnlineFlow.test.js --runInBand --forceExit
# Use a disposable test replica set, never a production connection:
KART_TEST_MONGO_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0 node --test test/kartStakeMongo.test.mjs
cd webapp
npx tsc -p tsconfig.kart.json
npm run build
npx vite build --config vite.kart.config.ts
```

The multiplayer test uses actual Socket.IO clients and drives both humans through
a full server-simulated race. It checks start/readiness gates, private-room
isolation, input tampering, malformed payloads, reconnect, rematch and cleanup.
Simulation tests cover all circuits/difficulties, screen-direction steering and
checkpoint validation. Real-phone visual/FPS and cross-network latency testing
remain release checks; simulated physics and build checks do not establish them.

The TPG tests cover human-only grids, account-bound reconnect, authoritative
finish order, settlement retry, load-timeout refunds and no-finisher refunds.
Ledger repository tests exercise atomic rollback, alias/double-seat rejection,
idempotent payouts and restart refunds. The separate MongoDB test exercises
actual transactions and concurrent reservations when `KART_TEST_MONGO_URI` is
set; it skips otherwise. The development workspace could not start MongoDB
(`open: Operation not permitted`), so the replica-set test remains a release gate.

The standalone `kart-royale.html` preview runs AI and career without the main
app's wallet or account providers. Its multiplayer panel clearly states when
there is no game-server connection. The integrated route obtains the existing
authenticated socket lazily. Deploy both the webapp and updated `bot/server.js`
to enable live multiplayer in TonPlaygram.
