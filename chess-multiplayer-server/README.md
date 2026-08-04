# Chess Battle Royal matchmaking

Authoritative Colyseus lobby service for two-player chess matches. The public queue can contain any number of online users, but Colyseus assigns exactly two players (Player 1 versus Player 2) to each match room; a third player is assigned to a new room. Private rooms are isolated by invitation code and reserve their two seats for the creator and one invited opponent. The match starts after both connected players mark themselves ready. Lobby readiness, countdown, capacity, and the 30-second reconnection window are enforced by the room server.

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_MATCHMAKING_URL=ws://localhost:2567` for local web preview. Deployments must use a public `wss://` URL (never `localhost`) when the website is served over HTTPS. Redis is not required; setting `REDIS_URL` enables distributed presence and room discovery.
