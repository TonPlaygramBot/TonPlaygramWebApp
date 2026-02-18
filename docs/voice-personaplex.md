# PersonaPlex voice integration

This repo supports a provider switch for voice synthesis:

- `VOICE_PROVIDER=personaplex` → use PersonaPlex wrapper service.
- `VOICE_PROVIDER=current` → use current browser TTS fallback.

## 1) Start the PersonaPlex wrapper service

```bash
export PERSONAPLEX_SERVICE_PORT=8787
export PERSONAPLEX_UPSTREAM_URL=https://integrate.api.nvidia.com
export PERSONAPLEX_API_KEY=<your_hf_or_nvidia_token>
npm run voice:service
```

Wrapper endpoints:

- `GET /health` → `{ ok, modelLoaded }`
- `POST /tts` with JSON:
  - `text` (required)
  - `voiceId` (optional)
  - `personaPrompt` (optional)
  - `format` (`wav` default)
  - `sampleRate` (optional)

## 2) App environment

Set:

```bash
export VOICE_PROVIDER=personaplex
export PERSONAPLEX_SERVICE_URL=http://127.0.0.1:8787
```

Optional fallback remote settings:

```bash
export PERSONAPLEX_API_URL=https://integrate.api.nvidia.com
export PERSONAPLEX_SYNTHESIS_PATH=/v1/speech/synthesize
```

## 3) Voice defaults

Defaults are centralized in:

- `bot/config/voiceDefaults.js`
- `webapp/src/voice/defaults.ts`

Help Center default voice uses a stable help profile.
Game commentary default voice uses a distinct stable profile.

## 4) Troubleshooting

- `provider: web-speech-fallback` in API responses means PersonaPlex was unreachable and app gracefully used browser speech.
- If running without GPU, keep short lines and lower sample rate for latency.
- If `/health` returns `modelLoaded: false`, configure upstream URL/token or run local PersonaPlex stack.
