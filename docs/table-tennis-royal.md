# Table Tennis Royal

Portrait React / TypeScript / Three.js game at `/games/tabletennisroyal`, with its own lobby at `/games/tabletennisroyal/lobby` and Games catalog card. The existing Tennis game is unchanged.

## Modes and controls

- Exhibition: three AI levels, best of 1/3/5 games, three shared HDR arenas, five player appearances.
- Career: five events, three rounds per event, server-stored account progress and earned footwork/power/reach upgrades. Preview progress is session-only.
- Online: the existing two-player TPC registration, stake selection, queue cancellation and matchmaking flow; arena and match format partition the queue. The server simulates the match and settles stakes. Clients send controls, never results or balances.
- Drag the table or use Left/Centre/Right to aim in screen coordinates. Select drive/topspin/backspin/smash and power. Auto return handles footwork and swing timing; turn it off to time HIT yourself. Tap SERVE when serving. Pause is available offline; leaving online retires from the match.

Scoring: games to 11, win by two, two-point service rotation, alternating service at deuce, changed first server each game. The simulation checks service toss, own/opponent service bounces, lets, net, out, volleys and second bounces. This is a playable arcade interpretation, not an ITTF-certified simulator.

## Architecture

`shared/tabletennis/engine.ts` is the deterministic 240 Hz simulation shared by client and server. Regenerate its committed JS and career JS with `node scripts/buildTableTennisEngine.mjs`. Rendering, audio, options, transport and React controls are separate modules under `webapp/src/games/tabletennis`.

`bot/services/tabletennisRoyal.js` owns match state, account-bound seats, reconnects and input validation. MongoDB stake reservations and idempotent payouts/refunds live in `tabletennisStake.js`; career revision and completion handling live in `tabletennisCareer.js`. Synthetic development accounts use an in-memory test store. Real accounts require transactional MongoDB, as in Tennis Royal.

Online simulation currently lives in one server process. Disconnects pause play; the reconnect grace period is 60 seconds. A remaining connected player wins on timeout; both absent seats refund. After process loss, persisted unsettled reservations expire/refund after two hours. Multi-instance deployment requires sticky match routing or a shared simulation owner before scaling horizontally.

## Preview and verification

Run normal app development with `npm run dev`, or frontend only with `npm --prefix webapp run dev`. `/table-tennis-preview.html` is the standalone session-only development preview. `node scripts/buildTableTennisPreview.mjs` builds an embedded conversation preview using the checked-in reduced assets. It intentionally has no account, wallet or online transport.

Checks:

```
node --test test/tableTennisEngine.test.mjs test/tableTennisRoyalIntegration.test.mjs test/tableTennisRoyalSocket.test.mjs
npx tsc -p tsconfig.tabletennis.json
npm --prefix webapp run build
```

Engine tests cover scoring, service, let/fault cases, input validation, timestep determinism and nine complete AI-match configurations. Service tests cover stake reservation/settlement/refund idempotency, reconnect identity, disconnect expiry, cancellation races and career persistence. The socket test uses two real Socket.IO clients with synthetic balances.

Browser verification covers the portrait preview, assets, serve/aim/spin controls, pause, player/arena selection and career navigation. The available browser has WebGL disabled and exercises the CPU compatibility renderer. Production WebGL rendering, performance and touch feel still need checks on iOS/Android devices. Real-account MongoDB transaction and deployment smoke checks remain staging gates. The full existing server suite cannot run in this environment because its native canvas binding is absent; the targeted tests do not need it.

Asset credits and the inherited Ready Player Me commercial-permission check are in `webapp/public/assets/table-tennis/CREDITS.md`.
