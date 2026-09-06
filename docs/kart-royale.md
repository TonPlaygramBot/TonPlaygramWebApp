# Kart Royale

Kart Royale adds a dedicated portrait-first 3D racing game to TonPlaygram's games
catalog at `/games/kartroyale/lobby` (also available at `/games/kartroyale`).

## Play

- **VS AI:** six racers, three circuits, Rookie / Street / Pro opponents.
- **Career:** Rookie, Street and Royale cups. Finish top three in the first two
  cups and first in the finale. Wins unlock the next cup; the first completion
  awards achievement credits. Progress and best times are saved on this device.
- **Multiplayer:** private six-character rooms and public quick matching for
  two to six connected players. Everyone readies up, then the host starts.
  Vacant seats fill with explicitly identified AI drivers. All races are free;
  this module never reads or changes token balances.

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
The game loop runs physics and AI at a fixed 60 Hz. Multiplayer clients send
bounded inputs at 30 Hz and receive room snapshots at approximately 20 Hz. The
server calculates movement, collision response, ordered lap checkpoints, race
time and standings. Client position/lap/score fields are ignored. Rendering
interpolates remote snapshots and predicts the local vehicle.

The server is attached to the existing authenticated Socket.IO connection. It
issues a private reconnect token in the joining client's acknowledgement and
never includes tokens in room broadcasts. Reconnect has a 15-second grace
period. Disconnected waiting players are removed and host ownership transfers.
Empty and expired rooms are collected. The race has a four-minute limit.

Run one authoritative game-server process for this initial version. Room state
is in memory and a server restart ends active races. Scaling requires shared
room ownership and routing players to the owning simulation; adding a broadcast
adapter alone is insufficient. Career saves are device-local, not account sync.

## Assets

`node webapp/scripts/build-kart-royale-assets.mjs` regenerates the two local GLB
detail levels. The chassis, tires, seat, driver and circuit construction adapt
the existing `WeaponKartGame.jsx` component approach. Engine audio reuses the
existing `/assets/sounds/race-care-151963.mp3`. See the adjacent asset attribution
file. No missing STK paths or remote vehicle models are required.

## Verification and preview

```sh
node --test test/kartRoyale.test.mjs
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

The standalone `kart-royale.html` preview runs AI and career without the main
app's wallet or account providers. Its multiplayer panel clearly states when
there is no game-server connection. The integrated route obtains the existing
authenticated socket lazily. Deploy both the webapp and updated `bot/server.js`
to enable live multiplayer in TonPlaygram.
