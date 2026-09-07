# Table Tennis Royal

Portrait React / TypeScript / Three.js game at `/games/tabletennisroyal`, with its own lobby at `/games/tabletennisroyal/lobby` and Games catalog card. The existing Tennis game is unchanged.

## Modes and controls

- Exhibition: three AI levels, best of 1/3/5 games, three bundled HDR arenas, five bundled player appearances, plus the solo player's already-unlocked shared cosmetics. Saved solo cosmetic choices remain available through Pause. All modes now use the same runtime; `LegacyGame.tsx` is no longer routed.
- Career: five events, three rounds per event, server-stored account progress and earned footwork/power/reach upgrades. Preview progress is session-only.
- Online: the existing two-player TPC registration, stake selection, queue cancellation and matchmaking flow; arena and match format partition the queue. The server simulates the match and settles stakes. Clients send controls, never results or balances.
- Tap the scene for a soft shot; swipe faster for more power. The recent 120 ms of finger velocity controls power independently of screen density, initial touch location and hold duration. The actual camera projection preserves the swipe's screen direction, including diagonals, either seat and changes of ends. Drive/topspin/backspin/smash remain selectable. Footwork is assisted; automatic hitting is off by default. Slightly early swipes wait for the legal bounce. Cancelled gestures, lost capture, pause and point transitions cannot fire a held stroke later. The soft-hit button also supports keyboard input.
- A two-row broadcast scoreboard shows account usernames, avatars with initials as a fallback, points, games and the serving indicator. Identity stays attached to the seat when ends change. Long usernames truncate without moving score columns. The camera leaves both players visible beneath the scoreboard at phone widths.

## Scale, ball and singles rules

The table is 2.74 × 1.525 m with its playing surface at 0.76 m. The net is 0.1525 m above it; the ball diameter is 40 mm. Human models are normalized to 1.75 m. Ground projection uses each HDRI's existing camera-height and rotation settings, independently of the game geometry. HDRIs remain panoramic photographs: this grounds their floor and proportions, not a reconstruction of every photographed object.

The rules follow the [2026 ITTF laws reproduced by Table Tennis England](https://www.tabletennisengland.co.uk/content/uploads/2026/07/Laws-of-Table-Tennis-2026-27.pdf): games to 11 with a two-point margin, two serves each then one at deuce, alternating first server, ends changed between games and at five in the deciding game. The first server is chosen by lot (the local conversation preview starts with the human).

Serves have a vertical, spin-free toss exceeding 16 cm and a descending strike behind the end line; they must bounce on each half in order. Legal net serves are lets, net returns remain playable, and top edges count while vertical sides do not. No second serve or invented 20-second serve penalty. The ten-minute expedite rule applies below 18 combined points, including alternating service and the receiver's 13-return limit. Paddle contact is scheduled after the required bounce, preventing volleys.

The swept ball solver handles table, upper edges, apron, net and floor contacts at 240 Hz. A 30 cm table drop rebounds about 23 cm. Bounces retain motion; dead-ball motion continues after a point and after the match, without scoring or settling again. Spin, racket timing, ball drag and animated body mechanics remain an arcade approximation; doubles, umpire conduct rulings and player-requested early expedite are outside this singles game.

## Architecture

`shared/tabletennis/engine.ts` coordinates the deterministic simulation. `rules.ts` owns scoring/service/ends, `physics.ts` owns collisions, and `swipe.ts` reuses the Tennis Royal velocity sampler. Regenerate their committed JS with `node scripts/buildTableTennisEngine.mjs`. Rendering, camera projection, broadcast UI, audio, options and transport are separate modules under `webapp/src/games/tabletennis`.

`bot/services/tabletennisRoyal.js` owns match state, account-bound seats, reconnects and input validation. MongoDB stake reservations and idempotent payouts/refunds live in `tabletennisStake.js`; career revision and completion handling live in `tabletennisCareer.js`. Synthetic development accounts use an in-memory test store. Real accounts require transactional MongoDB, as in Tennis Royal.

Online simulation currently lives in one server process. Disconnects pause play; the reconnect grace period is 60 seconds. A remaining connected player wins on timeout; both absent seats refund. After process loss, persisted unsettled reservations expire/refund after two hours. Multi-instance deployment requires sticky match routing or a shared simulation owner before scaling horizontally.

## Preview and verification

Run normal app development with `npm run dev`, or frontend only with `npm --prefix webapp run dev`. `/table-tennis-preview.html` is the standalone session-only development preview. `node scripts/buildTableTennisPreview.mjs` builds an embedded conversation preview using the checked-in reduced assets. It intentionally has no account, wallet or online transport.

Checks:

```
node --test test/tableTennisEngine.test.mjs test/tableTennisPhysicsRules.test.mjs test/tableTennisLegacyRuntime.test.mjs test/tableTennisRoyalIntegration.test.mjs test/tableTennisRoyalSocket.test.mjs
npx tsc -p tsconfig.tabletennis.json
npm --prefix webapp run build
node scripts/checkTableTennisBrowser.mjs
TABLE_TENNIS_PREVIEW_ASSETS=1 node scripts/checkTableTennisBrowser.mjs
```

The 29 automated tests include 228 serve combinations, all four return strokes at three powers, swept fast contacts, net/edge/floor cases, scoring/end changes/expedite, cancellation-safe sampling, fixed timestep determinism and nine complete AI-match configurations. Service tests cover stake reservation/settlement/refund idempotency, continued final ball motion, reconnect identity, disconnect expiry, cancellation races and career persistence. The socket test uses two real Socket.IO clients with synthetic balances.

The browser script checks the real React/Three game at 320, 390 and 480 px: 96 camera/direction cases, soft tap versus fast swipe, cancellation, pause, long usernames and avatars, eight rendered bounce/scoring cases, all bundled arenas, character switching and rematch. It can use production assets or the reduced conversation assets. Set `TABLE_TENNIS_BROWSER_EXECUTABLE` for a non-default Chromium and `TABLE_TENNIS_BROWSER_OUTPUT_DIR` to retain screenshots/results. Verification used Chromium with WebGL through SwiftShader, without browser errors. Physical iOS/Android touch feel and GPU performance, external owned cosmetic sources, and real-account MongoDB/deployment checks remain staging checks.

Asset credits and the inherited Ready Player Me commercial-permission check are in `webapp/public/assets/table-tennis/CREDITS.md`.
