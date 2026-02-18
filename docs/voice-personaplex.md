# PersonaPlex Voice Integration

This repo now supports a provider switch for speech synthesis:

- `VOICE_PROVIDER=personaplex` uses the local PersonaPlex Python wrapper service.
- `VOICE_PROVIDER=current` uses existing browser Web Speech fallback.

## 1) Start PersonaPlex wrapper service

```bash
export PERSONAPLEX_API_URL="https://<your-personaplex-endpoint>"
export PERSONAPLEX_API_KEY="<hf-or-service-token>"
export PERSONAPLEX_SYNTHESIS_PATH="/v1/speech/synthesize"
npm run voice:service
```

Wrapper endpoints:

- `GET /health` -> `{ ok, provider, modelLoaded }`
- `POST /tts` with JSON:
  - `text` (required)
  - `voiceId` (default `NATF0`)
  - `personaPrompt` (optional)
  - `format` (optional, currently wav)
  - `sampleRate` (optional)

The wrapper returns `audio/wav` bytes.

## 2) App env vars

Set these in the API process (`bot/server.js`) environment:

```bash
export VOICE_PROVIDER=personaplex
export PERSONAPLEX_MODE=auto
export PERSONAPLEX_SERVICE_URL="http://127.0.0.1:8090"
```

Optional strict remote direct mode:

```bash
export PERSONAPLEX_MODE=remote-api
export PERSONAPLEX_API_URL="https://<personaplex-api>"
export PERSONAPLEX_API_KEY="<token>"
```

For the webapp build:

```bash
export VITE_VOICE_PROVIDER=personaplex
```

## 3) Defaults and personas

See `webapp/src/voice/voiceConfig.ts`.

- Help Center default voice: `NATF0`
- Commentary default voice: `NATM1`
- Personas are centralized in this file.

## 4) Troubleshooting

- **PersonaPlex fallback was triggering unexpectedly:** keep `VOICE_PROVIDER=personaplex` with `PERSONAPLEX_MODE=auto` (default). The API now tries remote API first when configured, then local wrapper service.
- **No autoplay on mobile:** tap once anywhere to unlock audio; unlock hooks are installed globally.
- **CPU-only dev machine:** wrapper still returns valid WAV (tone fallback) so the app does not crash.
- **GPU offload:** ensure PersonaPlex backend itself is launched with CUDA-visible devices and enough VRAM.

## 5) Quick test

1. `npm run voice:service`
2. Run API + webapp.
3. Open Help Center and trigger voice help.
4. Open multiple games from Games page and play commentary.
5. Stop the wrapper service and verify fallback still speaks using browser voice.
