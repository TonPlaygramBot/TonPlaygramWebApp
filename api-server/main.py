import base64
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

GPU_SERVER_URL = os.getenv("GPU_SERVER_URL", "http://gpu-inference:8001")
STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "./storage"))
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "180"))

STORAGE_PATH.mkdir(parents=True, exist_ok=True)
AUDIO_DIR = STORAGE_PATH / "responses"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

sessions: dict[str, list[dict[str, str]]] = {}

app = FastAPI(title="PersonaPlex API Gateway", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class SupportTextRequest(BaseModel):
    messages: list[Message]
    sessionId: str = Field(min_length=1)
    voicePromptId: str | None = None


class CommentaryEventRequest(BaseModel):
    eventType: str = Field(min_length=1)
    eventPayload: dict[str, Any] = Field(default_factory=dict)
    sessionId: str = Field(min_length=1)
    voicePromptId: str | None = None


def remember_session_turn(session_id: str, role: str, content: str) -> None:
    history = sessions.setdefault(session_id, [])
    history.append({"role": role, "content": content, "at": datetime.utcnow().isoformat()})
    if len(history) > 30:
        del history[:-30]


async def call_gpu(method: str, path: str, **kwargs: Any) -> dict[str, Any]:
    url = f"{GPU_SERVER_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise HTTPException(status_code=exc.response.status_code, detail=f"GPU server rejected request: {detail}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"GPU server unreachable at {GPU_SERVER_URL}: {exc}") from exc


def maybe_store_audio(audio_base64: str | None) -> tuple[str | None, str | None]:
    if not audio_base64:
        return None, None
    audio_id = f"{uuid.uuid4().hex}.wav"
    output_path = AUDIO_DIR / audio_id
    output_path.write_bytes(base64.b64decode(audio_base64))
    audio_url = f"{PUBLIC_BASE_URL.rstrip('/')}/v1/audio/{audio_id}"
    return audio_base64, audio_url


@app.get("/v1/health")
async def health() -> dict[str, str]:
    gpu_health = await call_gpu("GET", "/v1/health")
    return {"status": "ok", "gpu": gpu_health.get("status", "unknown")}


@app.get("/v1/audio/{audio_id}")
async def get_audio(audio_id: str) -> FileResponse:
    path = AUDIO_DIR / audio_id
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path, media_type="audio/wav")


@app.post("/v1/support/text")
async def support_text(payload: SupportTextRequest) -> dict[str, Any]:
    remember_session_turn(payload.sessionId, "user", payload.messages[-1].content if payload.messages else "")
    gpu_response = await call_gpu("POST", "/v1/support/text", json=payload.model_dump())
    remember_session_turn(payload.sessionId, "assistant", gpu_response.get("text", ""))
    audio_base64, audio_url = maybe_store_audio(gpu_response.get("audioBase64"))
    return {"text": gpu_response.get("text", ""), "audioBase64": audio_base64, "audioUrl": audio_url}


@app.post("/v1/commentary/event")
async def commentary_event(payload: CommentaryEventRequest) -> dict[str, Any]:
    gpu_response = await call_gpu("POST", "/v1/commentary/event", json=payload.model_dump())
    audio_base64, audio_url = maybe_store_audio(gpu_response.get("audioBase64"))
    return {"text": gpu_response.get("text", ""), "audioBase64": audio_base64, "audioUrl": audio_url}


@app.post("/v1/support/voice")
async def support_voice(
    audio: UploadFile = File(...),
    sessionId: str = Form(...),
    voicePromptId: str | None = Form(default=None),
) -> dict[str, Any]:
    audio_bytes = await audio.read()
    files = {"audio": (audio.filename or "clip.webm", audio_bytes, audio.content_type or "application/octet-stream")}
    data = {"sessionId": sessionId}
    if voicePromptId:
        data["voicePromptId"] = voicePromptId
    gpu_response = await call_gpu("POST", "/v1/support/voice", data=data, files=files)
    remember_session_turn(sessionId, "assistant", gpu_response.get("text", ""))
    audio_base64, audio_url = maybe_store_audio(gpu_response.get("audioBase64"))
    return {"text": gpu_response.get("text", ""), "audioBase64": audio_base64, "audioUrl": audio_url}


@app.post("/v1/voices")
async def create_voice(voice: UploadFile = File(...), label: str = Form(...)) -> dict[str, Any]:
    voice_bytes = await voice.read()
    files = {"voice": (voice.filename or "voice.wav", voice_bytes, voice.content_type or "audio/wav")}
    return await call_gpu("POST", "/v1/voices", data={"label": label}, files=files)


@app.get("/v1/voices")
async def list_voices() -> dict[str, Any]:
    return await call_gpu("GET", "/v1/voices")
