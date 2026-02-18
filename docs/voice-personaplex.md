# PersonaPlex Voice Integration (Real Setup)

This project is wired to use **NVIDIA PersonaPlex** as the primary voice engine.

## What runs where

- **Webapp (TypeScript):** sends text + voice settings to `/api/voice-commentary/speak`.
- **Bot API (Node/Express):** routes synthesis through PersonaPlex.
- **PersonaPlex wrapper (Python):** `services/personaplex/service.py` runs `moshi.offline` from a local `nvidia/personaplex` clone and returns `audio/wav`.

> Important: by default, this is configured to be PersonaPlex-first. Browser Web Speech fallback is disabled unless explicitly enabled.

---

## 1) Install PersonaPlex from source (official open-source repo)

```bash
git clone https://github.com/nvidia/personaplex.git ~/personaplex
cd ~/personaplex

# system dependency
sudo apt-get update
sudo apt-get install -y libopus-dev

# python env
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip

# install from repo (README path)
pip install moshi/.

# if your GPU needs it, use matching torch/cu build
# pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130

# HuggingFace token with accepted PersonaPlex model license
export HF_TOKEN="<your_hf_token>"
```

---

## 2) Configure this project to use local PersonaPlex

### PersonaPlex wrapper process

```bash
export PERSONAPLEX_BACKEND=offline
export PERSONAPLEX_REPO_PATH="$HOME/personaplex"
export PERSONAPLEX_SERVICE_PORT=8090
npm run voice:service
```

Wrapper endpoints:

- `GET /health`
- `POST /tts` with JSON:
  - `text` (required)
  - `voiceId` (`NATF0`, `NATM1`, etc.)
  - `personaPrompt` (optional)
  - `sampleRate` (optional)

### App/API env

```bash
export VOICE_PROVIDER=personaplex
export PERSONAPLEX_MODE=service
export PERSONAPLEX_SERVICE_URL="http://127.0.0.1:8090"

# keep fallback OFF for strict PersonaPlex behavior
unset PERSONAPLEX_ALLOW_WEB_FALLBACK
```

### Webapp env

```bash
export VITE_VOICE_PROVIDER=personaplex

# keep fallback OFF for strict PersonaPlex behavior
unset VITE_VOICE_ALLOW_CURRENT_FALLBACK
```

---

## 3) Voice defaults

Defined in `webapp/src/voice/voiceConfig.ts`:

- Help Center voice: `NATF0`
- Commentary voice: `NATM1`

---

## 4) Troubleshooting (PersonaPlex-specific)

- **`/tts` returns 503 with model errors:**
  - verify `HF_TOKEN` is set in the same shell where wrapper runs.
  - ensure PersonaPlex model license is accepted on HuggingFace.
- **`PERSONAPLEX_REPO_PATH` errors:**
  - point it to your local clone of `nvidia/personaplex`.
- **GPU memory issues:**
  - add offload flags, e.g.:
    ```bash
    export PERSONAPLEX_OFFLINE_FLAGS="--cpu-offload"
    ```
  - install `accelerate` if using CPU offload.
- **No audio in browser on mobile:**
  - tap once to unlock audio playback; the app includes unlock hooks for touch devices.

---

## 5) Quick verification checklist

1. Start wrapper: `npm run voice:service`
2. Check wrapper: `curl http://127.0.0.1:8090/health`
3. Start API + webapp with env above.
4. Open Help Center and trigger speech.
5. Open Games page and play commentary for multiple games.

If PersonaPlex is not working, the API now returns explicit error details so you can fix setup directly instead of silently hearing browser fallback.
