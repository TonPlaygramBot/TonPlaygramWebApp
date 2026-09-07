# Main app and chess on one Render service

`tonplaygram-bot` serves the web app, API, Socket.IO, social wall media and chess
matchmaking. The existing `protest-media` disk remains mounted at
`/var/data/tonplaygram`; this change does not resize or replace it.

The bot's `postinstall` builds `chess-multiplayer-server`, so the existing Render
build command continues to work. `bot/server.js` starts the compiled chess module
in the same Node process, binds its transport to an ephemeral loopback port, and
proxies `/colyseus` HTTP and WebSocket requests. Only the main Render port is
public. Socket.IO keeps `/socket.io/`.

Chess authenticates and reserves/releases stakes through the main process's
loopback account API, using the existing secret or a generated process-local
secret. Embedded rooms use local presence and storage, suitable for the existing
single instance and persistent disk. No extra Render service or Redis instance
is required.

Set `VITE_MATCHMAKING_URL` to
`wss://tonplaygram-bot.onrender.com/colyseus`. Clients also normalize the retired
standalone hostname to the main API if an old environment value is still present.
Local development can explicitly set `ws://localhost:2567` to use the standalone
chess entrypoint, or use `http://localhost:3000` as the API base for integrated mode.

## Deployment and retirement

1. Deploy the main branch to the existing `tonplaygram-bot` service.
2. Verify `/api/health`, `/api/flamingo-wall/health`, and `/colyseus/health`.
3. Verify chess HTTP and WebSocket traffic uses the main hostname, and Socket.IO
   continues to connect. Allow any matches on the previous deployment to finish.
4. Delete only `tonplaygram-chess-matchmaking` from Render after verification.
   Removing its Blueprint entry prevents recreation; it does not delete the
   existing resource automatically. Keep the main service and its disk.

Validation: `npm test --prefix chess-multiplayer-server`,
`npm run build --prefix chess-multiplayer-server`, and
`npm run test:navigation --prefix webapp`. Integration tests use local fake account
responses and never modify production balances or posts.

The global Back provider now handles every route in Telegram and the native
Android bridge, while page hooks register only game-specific confirmations or
fallback routes. Browser navigation uses its normal history. Native binaries
that bundle the web app need rebuilding to receive this change; Telegram and
browser clients receive the deployed web bundle.
