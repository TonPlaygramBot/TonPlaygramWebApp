# NVIDIA PersonaPlex Voice Commentary Integration

This project now supports **cross-game voice commentary** using NVIDIA PersonaPlex.

## What changed

- Voice catalog can be fetched from PersonaPlex dynamically (`PERSONAPLEX_API_URL` + `PERSONAPLEX_API_KEY`), with fallback catalog when credentials are not configured.
- English commentary is free by default for all users.
- Voice language packs are modeled as **global store entitlements** (`voiceLanguage`) and apply to all games, not just one game.
- Selected commentary voice is shared across games via `voiceCommentaryInventory`.

## API routes

### Platform help API (`packages/api/src/server.ts`)

- `GET /v1/voice/catalog`
- `POST /v1/voice/commentary`
- `POST /v1/voice/support`

When PersonaPlex credentials are missing, synthesis endpoints fail fast with a clear configuration error.

### Main game API (`bot/server.js`)

- `GET /api/voice-commentary/catalog` — returns provider catalog + generated voice language store items.
- `POST /api/voice-commentary/catalog/refresh` — refreshes remote voice catalog.
- `GET /api/voice-commentary/inventory/:accountId` — returns normalized cross-game owned/selected voices.
- `POST /api/voice-commentary/select` — selects an owned voice.

## Store integration

`/store/voicecommentary` now includes commentary language packs:

- English (`en-US`) pack is free by default.
- Purchased language packs unlock voice commentary usage in all games.

Purchases with item type `voiceLanguage` are applied server-side in `/api/store/purchase` and persisted to `user.voiceCommentaryInventory`.

## Environment variables

- `PERSONAPLEX_API_URL` - PersonaPlex API base URL
- `PERSONAPLEX_API_KEY` - optional Bearer token (not required for local/open PersonaPlex deployments)
- `PERSONAPLEX_VOICES_PATH` - optional voices path (default `/v1/voices`)
- `PERSONAPLEX_SYNTHESIS_PATH` - optional synthesis path (default `/v1/speech/synthesize`)

The server now tries multiple PersonaPlex-compatible payload formats automatically so you can run against NVIDIA PersonaPlex OSS endpoints without custom code changes.
