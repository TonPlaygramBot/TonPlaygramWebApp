# Multiplayer Backend (Node.js + TypeScript)

Production-oriented backend for online PvP with Express API + Socket.IO realtime, Redis matchmaking/session coordination, and PostgreSQL persistence.

## Folder structure

```txt
multiplayer-backend/
  docs/
    socket-event-contracts.md
  nginx/
    default.conf
  prisma/
    migrations/
    schema.prisma
  src/
    api/
      app.ts
      routes/
        health.ts
        matches.ts
    config/
      env.ts
    db/
      prisma.ts
    logger/
      index.ts
    middleware/
      auth.ts
      errorHandler.ts
      security.ts
    redis/
      redisClient.ts
    repositories/
      auditRepository.ts
      matchRepository.ts
      userRepository.ts
    services/
      gameValidator.ts
      matchmakingService.ts
      matchStateService.ts
      roomService.ts
      sessionRegistry.ts
    types/
      events.ts
      socket.ts
    utils/
      validation.ts
    ws/
      socketAuth.ts
      socketGateway.ts
    index.ts
  tests/
    matchmakingService.test.ts
    roomService.test.ts
  .env.example
  Dockerfile
  docker-compose.yml
  package.json
  tsconfig.json
```

## Features implemented

- Player socket connection, disconnect, and reconnect handling.
- Authentication-ready middleware/token structure (`Bearer userId:username` placeholder).
- Lobby and matchmaking queue with Redis-backed coordination.
- Private room create/join/leave with short room codes.
- Authoritative server match action flow (`match:action` validation + state broadcast).
- Basic anti-cheat validation scaffold with TODO extension points.
- Ping heartbeat using Socket.IO plus explicit `ping` event handling.
- Match result submission and persistent match history storage.
- Health check endpoint (`GET /api/health`) with DB + Redis checks.
- Security baseline: CORS, Helmet, API rate limit, payload validation.

## Local setup

1. Copy env file:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Start infra (Postgres/Redis) and app via Docker:
   ```bash
   docker compose up --build
   ```

## Run without Docker (dev)

```bash
npm install
npm run prisma:generate
npm run prisma:migrate:dev
npm run dev
```

## Production deploy on Linux VPS / VM

1. Provision VM (Ubuntu 22.04+), open ports 80/443.
2. Install Docker + Docker Compose plugin.
3. Clone repository and enter `multiplayer-backend/`.
4. Create `.env` with production secrets (`JWT_SECRET`, database credentials, CORS origin).
5. Build and run services:
   ```bash
   docker compose up -d --build
   ```
6. Verify health endpoint:
   ```bash
   curl http://YOUR_DOMAIN/api/health
   ```
7. For HTTPS, place Nginx behind certbot-managed certs (or add TLS server block in `nginx/default.conf`).

## Build & startup commands

- Build TypeScript: `npm run build`
- Start production app: `npm run start`
- Run Prisma migrations in prod: `npm run prisma:migrate`

## Scalability notes

- Redis matchmaking queue is externalized for multi-instance growth.
- Session and room managers are modular and can be moved to Redis adapters.
- Game validation/state services are isolated so game rules can be replaced.

## Example API

- `GET /api/health`
- `GET /api/matches/history` with `Authorization: Bearer userId:username`

## Tests

```bash
npm run test
```

Includes automated tests for:
- Matchmaking pair lifecycle.
- Room create/join/cleanup lifecycle.
