# PersonaPlex Voice Integration (Strict Mode)

This setup is now **PersonaPlex-first**. When `VOICE_PROVIDER=personaplex`, the app should play PersonaPlex audio, not browser fallback audio.

## 1) Install PersonaPlex model/runtime (official open-source flow)

From NVIDIA PersonaPlex README (`nvidia/personaplex`):

```bash
sudo apt install -y libopus-dev
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install moshi/.
```

Accept the HF model license for `nvidia/personaplex-7b-v1`, then:

```bash
export HF_TOKEN="<your_huggingface_token>"
```

## 2) Run PersonaPlex server (upstream)

```bash
SSL_DIR=$(mktemp -d)
python -m moshi.server --ssl "$SSL_DIR"
```

If VRAM is low:

```bash
python -m moshi.server --ssl "$SSL_DIR" --cpu-offload
```

## 3) Run this repo’s wrapper service

Wrapper script:

```bash
npm run voice:service
```

Required env vars for wrapper:

```bash
export PERSONAPLEX_API_URL="https://<moshi-server-host>:8998"
export PERSONAPLEX_API_KEY=""              # set only if your gateway needs auth
export PERSONAPLEX_SYNTHESIS_PATH="/v1/speech/synthesize"
export PERSONAPLEX_HEALTH_PATH="/health"
```

Wrapper endpoints:
- `GET /health`
- `POST /tts` with `{ text, voiceId, personaPrompt?, format?: "wav", sampleRate? }`

## 4) App env vars (strict PersonaPlex)

Backend (`bot/server.js`):

```bash
export VOICE_PROVIDER=personaplex
export PERSONAPLEX_MODE=service
export PERSONAPLEX_SERVICE_URL="http://127.0.0.1:8090"
```

Webapp build:

```bash
export VITE_VOICE_PROVIDER=personaplex
```

## 5) Behavior guarantees in current code

- `/api/voice-commentary/help` and `/api/voice-commentary/speak` return **503** when PersonaPlex synthesis fails.
- No synthetic tone fallback in the wrapper.
- No automatic browser Web Speech fallback when PersonaPlex provider is selected.

## 6) Troubleshooting

- If you hear no voice, check these in order:
  1. `curl http://127.0.0.1:8090/health`
  2. `curl -X POST http://127.0.0.1:8090/tts -H 'content-type: application/json' -d '{"text":"test","voiceId":"NATM1"}' --output /tmp/test.wav`
  3. Confirm API env uses `VOICE_PROVIDER=personaplex`.
  4. Confirm webapp env uses `VITE_VOICE_PROVIDER=personaplex`.
- Mobile autoplay requires one user tap to unlock audio output.
