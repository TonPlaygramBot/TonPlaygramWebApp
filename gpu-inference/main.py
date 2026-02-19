import asyncio
import base64
import io
import json
import os
import uuid
import wave
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

MODEL_NAME = os.getenv("PERSONAPLEX_MODEL_NAME", "NVIDIA/PersonaPlex")
MODEL_PATH = os.getenv("PERSONAPLEX_MODEL_PATH", "")
VOICE_STORAGE_PATH = Path(os.getenv("VOICE_STORAGE_PATH", "./storage/voices"))
MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY", "2"))
FALLBACK_TEXT_ONLY = os.getenv("FALLBACK_TEXT_ONLY", "false").lower() == "true"

VOICE_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
VOICE_INDEX_PATH = VOICE_STORAGE_PATH / "voices.json"

app = FastAPI(title="PersonaPlex GPU Inference", version="1.0.0")
semaphore = asyncio.Semaphore(MAX_CONCURRENCY)


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


class PersonaPlexEngine:
    """Light wrapper around PersonaPlex runtime.

    Replace `_lazy_load_model` and inference methods with exact API calls from
    NVIDIA/personaplex for your selected checkpoint/runtime.
    """

    def __init__(self) -> None:
        self.ready = False
        self.error: str | None = None
        self.model: Any = None

    def _lazy_load_model(self) -> None:
        if self.ready or self.error:
            return
        try:
            if FALLBACK_TEXT_ONLY:
                self.ready = True
                return

            # NOTE: Integration point for NVIDIA PersonaPlex.
            # Expected workflow:
            #   1) clone https://github.com/NVIDIA/personaplex
            #   2) install project requirements
            #   3) import the pipeline class here and load MODEL_PATH / MODEL_NAME
            # Example pseudo-code:
            #   from personaplex import PersonaPlexPipeline
            #   self.model = PersonaPlexPipeline.from_pretrained(MODEL_NAME, model_path=MODEL_PATH)
            self.model = None
            self.ready = True
        except Exception as exc:  # pragma: no cover
            self.error = str(exc)

    def health(self) -> dict[str, str]:
        self._lazy_load_model()
        if self.error:
            return {"status": "error", "detail": self.error}
        if FALLBACK_TEXT_ONLY:
            return {"status": "degraded", "detail": "FALLBACK_TEXT_ONLY=true, audio generation disabled"}
        return {"status": "ok", "detail": f"model={MODEL_NAME}"}

    async def transcribe_and_reply(self, audio_bytes: bytes, session_id: str, voice_prompt_id: str | None) -> dict[str, str | None]:
        self._lazy_load_model()
        if self.error:
            raise RuntimeError(self.error)

        # Placeholder transcription. In production use PersonaPlex ASR output.
        transcribed = f"Voice request ({len(audio_bytes)} bytes) received for session {session_id}."
        text = f"I heard you. How can I help you further? ({transcribed})"
        audio_base64 = None if FALLBACK_TEXT_ONLY else synthesize_wave_base64(text, voice_prompt_id)
        return {"text": text, "audioBase64": audio_base64}

    async def chat_and_speak(self, prompt: str, voice_prompt_id: str | None) -> dict[str, str | None]:
        self._lazy_load_model()
        if self.error:
            raise RuntimeError(self.error)

        text = f"Assistant response: {prompt[:280]}"
        audio_base64 = None if FALLBACK_TEXT_ONLY else synthesize_wave_base64(text, voice_prompt_id)
        return {"text": text, "audioBase64": audio_base64}


engine = PersonaPlexEngine()


def load_voice_index() -> list[dict[str, str]]:
    if not VOICE_INDEX_PATH.exists():
        return []
    return json.loads(VOICE_INDEX_PATH.read_text())


def save_voice_index(voices: list[dict[str, str]]) -> None:
    VOICE_INDEX_PATH.write_text(json.dumps(voices, indent=2))


def synthesize_wave_base64(text: str, voice_prompt_id: str | None) -> str:
    # Simple synthetic tone placeholder to keep the pipeline executable.
    # Replace with PersonaPlex speech synthesis result bytes.
    duration_sec = max(1, min(4, len(text) // 50 + 1))
    sample_rate = 22050
    freq = 220 if not voice_prompt_id else 220 + (sum(ord(c) for c in voice_prompt_id) % 220)
    amplitude = 8000
    frames = bytearray()
    import math

    for n in range(duration_sec * sample_rate):
        sample = int(amplitude * math.sin(2 * math.pi * freq * (n / sample_rate)))
        frames.extend(sample.to_bytes(2, byteorder="little", signed=True))

    with io.BytesIO() as buffer:
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(frames)
        return base64.b64encode(buffer.getvalue()).decode("utf-8")


@app.get("/v1/health")
async def health() -> dict[str, str]:
    return engine.health()


@app.post("/v1/voices")
async def create_voice(voice: UploadFile = File(...), label: str = Form(...)) -> dict[str, Any]:
    ext = Path(voice.filename or "voice.wav").suffix or ".wav"
    voice_prompt_id = f"vp_{uuid.uuid4().hex[:12]}"
    filename = f"{voice_prompt_id}{ext}"
    target = VOICE_STORAGE_PATH / filename

    content = await voice.read()
    if len(content) < 200:
        raise HTTPException(status_code=400, detail="Voice sample is too short. Upload at least ~1 second.")

    target.write_bytes(content)
    voices = load_voice_index()
    item = {
        "voicePromptId": voice_prompt_id,
        "label": label,
        "file": filename,
        "createdAt": datetime.utcnow().isoformat(),
    }
    voices.append(item)
    save_voice_index(voices)
    return item


@app.get("/v1/voices")
async def list_voices() -> dict[str, Any]:
    return {"voices": load_voice_index()}


@app.post("/v1/support/text")
async def support_text(payload: SupportTextRequest) -> dict[str, str | None]:
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")
    latest = payload.messages[-1].content
    async with semaphore:
        return await engine.chat_and_speak(latest, payload.voicePromptId)


@app.post("/v1/commentary/event")
async def commentary_event(payload: CommentaryEventRequest) -> dict[str, str | None]:
    event_summary = f"Commentary on {payload.eventType}: {json.dumps(payload.eventPayload)[:240]}"
    async with semaphore:
        return await engine.chat_and_speak(event_summary, payload.voicePromptId)


@app.post("/v1/support/voice")
async def support_voice(
    audio: UploadFile = File(...),
    sessionId: str = Form(...),
    voicePromptId: str | None = Form(default=None),
) -> dict[str, str | None]:
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="audio file is empty")

    async with semaphore:
        return await engine.transcribe_and_reply(audio_bytes, sessionId, voicePromptId)
