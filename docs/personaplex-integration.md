# PersonaPlex End-to-End Voice Integration

This repository now includes a modular setup for:

- `frontend/` (React + TypeScript voice UI)
- `api-server/` (FastAPI gateway for validation, CORS, session bookkeeping, and audio URL hosting)
- `gpu-inference/` (FastAPI service that wraps PersonaPlex running on CUDA GPU)
- `docs/` (this setup/deployment guide)

## 1) Repository Structure

```text
/frontend
/api-server
/gpu-inference
/docs
```

## 2) GPU Machine Setup (PersonaPlex host)

> PersonaPlex must run on a CUDA-capable GPU instance. Do not run model inference on shared CPU-only hosting.

### Check NVIDIA driver + CUDA runtime

```bash
nvidia-smi
nvcc --version
```

If `nvcc` is missing, install CUDA toolkit matching your driver.

### Create Python environment

```bash
cd gpu-inference
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Install PersonaPlex itself

Use NVIDIA’s official repo for runtime/model instructions:

- https://github.com/NVIDIA/personaplex

Typical flow:

```bash
git clone https://github.com/NVIDIA/personaplex.git
cd personaplex
pip install -e .
```

### Download model weights

Model checkpoints are provided per NVIDIA PersonaPlex documentation/model cards (usually from NGC or Hugging Face links referenced in the official repo).

Set either:

- `PERSONAPLEX_MODEL_NAME` (remote model identifier), or
- `PERSONAPLEX_MODEL_PATH` (local downloaded checkpoint path)

in `gpu-inference/.env`.

## 3) API Server Setup (CPU VPS acceptable)

```bash
cd api-server
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
```

Configure:

- `GPU_SERVER_URL` -> public/private URL of the GPU inference service
- `CORS_ORIGINS` -> allowed frontend origins
- `PUBLIC_BASE_URL` -> URL clients should use for `audioUrl`

## 4) Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Set frontend env (example):

```bash
echo 'VITE_API_BASE_URL=http://localhost:8000' > .env
```

## 5) Endpoints

### Health
- `GET /v1/health`

### Support voice
- `POST /v1/support/voice`
- multipart form-data: `audio` (`webm`/`wav`), `sessionId`, optional `voicePromptId`
- response: `{ text, audioBase64, audioUrl }`

### Support text
- `POST /v1/support/text`
- body: `{ messages:[{role,content}], sessionId, voicePromptId? }`
- response: `{ text, audioBase64, audioUrl }`

### Commentary event
- `POST /v1/commentary/event`
- body: `{ eventType, eventPayload, sessionId, voicePromptId? }`
- response: `{ text, audioBase64, audioUrl }`

### Voices (voice prompts)
PersonaPlex uses reference voice prompt audio, not a fixed hardcoded voice list.

- `POST /v1/voices` upload short reference clip with `label`
- `GET /v1/voices` list saved voice prompts

Generate 3 sample prompts:

```bash
cd gpu-inference
python scripts/generate_sample_voice_prompts.py
```

Then upload generated files through your API endpoint/UI.

## 6) Docker Compose (local/dev)

```bash
cp api-server/.env.example api-server/.env
cp gpu-inference/.env.example gpu-inference/.env
docker compose up --build
```

Services:

- `api-server` (port 8000)
- `gpu-inference` (port 8001, GPU reservation)
- `redis` (optional session cache baseline)

If you run GPU inference on a separate host, deploy only `api-server` locally and set `GPU_SERVER_URL` to remote.

## 7) Deployment Topology

- Frontend: Hostinger / Netlify / Vercel / static host
- API server: CPU VPS (FastAPI)
- GPU inference: GPU provider (Lightning AI, RunPod, Modal, Paperspace, etc.)

For testing only, temporary/free GPU services (Colab etc.) may sleep or reset.

## 8) Fallback Mode (no GPU)

When no GPU is available, set:

```env
FALLBACK_TEXT_ONLY=true
```

This disables generated voice audio and returns text-only responses. Frontend shows audio unavailable state.

## 9) Troubleshooting

### Mic permission denied
- Browsers require HTTPS or `localhost` for microphone APIs.
- Trigger `getUserMedia` from a direct click (`Enable Microphone` button already does this).

### CORS errors
- Add frontend URL to `CORS_ORIGINS` in `api-server/.env`.
- Restart API service after config change.

### CUDA not found
- Verify `nvidia-smi` and `nvcc --version`.
- Ensure container runtime has GPU pass-through (`--gpus all` or compose GPU device reservation).

### Model download is too large
- Keep checkpoints in mounted persistent volume.
- Use smaller/quantized checkpoints where PersonaPlex supports it.

### Latency is high
- Keep prompts concise.
- Lower max generation length.
- Use quantization if supported by your PersonaPlex stack.
- Increase concurrency carefully (`MAX_CONCURRENCY`) to avoid VRAM exhaustion.
