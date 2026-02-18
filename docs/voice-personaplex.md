# PersonaPlex Voice Setup (Strict, No Silent Fallback)

This integration is now configured to prioritize **real PersonaPlex audio output**.

- `VOICE_PROVIDER=personaplex` is required.
- Browser Web Speech fallback is **disabled by default**.
- If PersonaPlex is down/misconfigured, API returns an explicit error instead of silently playing another voice.

---

## 1) Install and run PersonaPlex backend (NVIDIA OSS)

Use the official `nvidia/personaplex` project as your synthesis backend.

### Option A — run PersonaPlex directly (recommended if you already have it)

1. Start PersonaPlex server from `nvidia/personaplex` according to upstream docs.
2. Confirm it exposes synthesis endpoint compatible with:
   - `POST /v1/speech/synthesize`
3. Confirm health endpoint:
   - `GET /health`

### Option B — use your existing PersonaPlex deployment URL

Set:

```bash
export PERSONAPLEX_API_URL="https://<your-personaplex-host>"
export PERSONAPLEX_SYNTHESIS_PATH="/v1/speech/synthesize"
export PERSONAPLEX_HEALTH_PATH="/health"
# if needed
export PERSONAPLEX_API_KEY="<token>"
```

---

## 2) Run local wrapper service (Python)

The wrapper proxies to PersonaPlex and returns `audio/wav`.

```bash
export PERSONAPLEX_API_URL="https://<your-personaplex-host>"
export PERSONAPLEX_STRICT_REMOTE=1
npm run voice:service
```

Wrapper API:

- `GET /health`
- `POST /tts` `{ text, voiceId, personaPrompt?, format?, sampleRate?, locale? }`

### Strict mode

- `PERSONAPLEX_STRICT_REMOTE=1` (default): return `503` when PersonaPlex fails.
- No synthetic tone is generated anymore.

---

## 3) App env configuration (backend + webapp)

Backend (`bot/server.js` process):

```bash
export VOICE_PROVIDER=personaplex
export PERSONAPLEX_MODE=service
export PERSONAPLEX_SERVICE_URL="http://127.0.0.1:8090"
# keep this 0 unless you explicitly want browser fallback
export VOICE_ALLOW_CLIENT_FALLBACK=0
```

Webapp:

```bash
export VITE_VOICE_PROVIDER=personaplex
# keep this 0 unless you explicitly want browser fallback
export VITE_VOICE_ALLOW_FALLBACK=0
```

---

## 4) Defaults and personas

Configured in `webapp/src/voice/voiceConfig.ts`:

- Help Center voice: `NATF0`
- Commentary voice: `NATM1`
- Persona prompts centralized for both contexts.

---

## 5) Verify PersonaPlex is actually used

1. Start PersonaPlex backend.
2. Start wrapper: `npm run voice:service`.
3. Check wrapper health:
   - `curl http://127.0.0.1:8090/health`
4. Start app API + webapp with env vars above.
5. Open Help Center and run speak.
6. Open several Games entries and trigger commentary.

If PersonaPlex fails, you should now get explicit error responses (not hidden Web Speech), which makes setup issues visible and fixable quickly.

---

## 6) Troubleshooting

- **503 from `/api/voice-commentary/speak`**: PersonaPlex endpoint is not reachable or credentials invalid.
- **`/health` fails**: check `PERSONAPLEX_API_URL` and path envs.
- **No audio on mobile after success response**: tap once to unlock audio playback (mobile autoplay policy).
