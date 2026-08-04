# Chess Battle Royal matchmaking

Authoritative Colyseus lobby service for 4–8 players. Public Quick Match rooms are discovered by Colyseus; private rooms are isolated by invitation code. Lobby readiness, countdown, capacity, and the 30-second reconnection window are enforced by the room server.

```bash
cp .env.example .env
npm install
npm run dev
```

Set `VITE_CHESS_COLYSEUS_URL=ws://localhost:2567` in `webapp/.env`. Redis is not required; setting `REDIS_URL` enables distributed presence and room discovery.
