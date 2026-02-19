# NVIDIA PersonaPlex Voice Integration (Help Center + All Game Commentary)

This app now uses a single voice pipeline for:

- **Help Center voice replies** (`/v1/support/voice`, `/v1/support/text`)
- **Commentary across all game pages** via shared `speakCommentaryLines` → `/v1/commentary/event`

## Important behavior fixes

- Commentary **does not request microphone permission**.
- Microphone permission is requested only from explicit Help Center button clicks.
- If PersonaPlex is unreachable, server returns a local WAV fallback so users still hear audio (instead of silent failures).

## Active API routes (`packages/api/src/server.ts`)

- `GET /v1/health`
- `POST /v1/support/voice` (multipart audio)
- `POST /v1/support/text`
- `POST /v1/commentary/event`
- `POST /v1/voices`
- `GET /v1/voices`

## NVIDIA PersonaPlex configuration

Set these env vars for the API service:

- `PERSONAPLEX_API_URL` → base URL of your NVIDIA PersonaPlex/NIM endpoint
- `PERSONAPLEX_API_KEY` → bearer key/token for PersonaPlex
- `PERSONAPLEX_TTS_PATH` → TTS route path (default: `/v1/speech/synthesize`)
- `PERSONAPLEX_MODEL` → optional model name (if your deployment expects one)
- `PERSONAPLEX_LOCAL_FALLBACK` → `1` (default) to allow audible local fallback, `0` for strict production mode

### Supported response patterns

The backend accepts either:

1. JSON with `audioUrl`/`audioBase64` fields, or
2. raw `audio/*` response body.

This makes it compatible with common PersonaPlex/NIM deployment shapes.

## Production recommendation

On production GPU hosts set:

- `PERSONAPLEX_LOCAL_FALLBACK=0`

so any misconfiguration fails fast and can be monitored immediately.
