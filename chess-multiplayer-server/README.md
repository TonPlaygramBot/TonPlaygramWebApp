# Chess Battle Royal matchmaking

Authoritative Colyseus lobby service for two-player chess matches. The public queue can contain any number of online users, but Colyseus assigns exactly two players (Player 1 versus Player 2) to each match room; a third player is assigned to a new room. Private rooms are isolated by invitation code and reserve their two seats for the creator and one invited opponent. The match starts after both connected players mark themselves ready. Lobby readiness, countdown, capacity, and the 30-second reconnection window are enforced by the room server.

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_MATCHMAKING_URL=ws://localhost:2567` for local web preview. Deployments must use a public `wss://` URL (never `localhost`) when the website is served over HTTPS. Redis is not required; setting `REDIS_URL` enables distributed presence and room discovery.

Production additionally requires `ACCOUNT_API_URL`, `MATCHMAKING_SERVICE_SECRET`, and `AUTH_REQUIRED=true`. The trusted account API authenticates Telegram or resolves a browser/Google identity against the user database, returns the canonical TPG account and balance, and performs idempotent stake reservations/refunds in MongoDB transactions.

The Render blueprint deploys this server as the separate `tonplaygram-chess-matchmaking` web service. Apply the blueprint (rather than deploying only the main web service), set the same `MATCHMAKING_SERVICE_SECRET` on both services, and confirm `https://tonplaygram-chess-matchmaking.onrender.com/health` returns JSON before enabling Online mode. Browser/Google players are resolved against the account database using their stored Google or TPG account identity; Telegram players continue to use signed Web App init data.
