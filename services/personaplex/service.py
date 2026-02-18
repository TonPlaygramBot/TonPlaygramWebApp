#!/usr/bin/env python3
import io
import json
import math
import os
import struct
import subprocess
import tempfile
import wave
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

HOST = os.getenv('PERSONAPLEX_SERVICE_HOST', '0.0.0.0')
PORT = int(os.getenv('PERSONAPLEX_SERVICE_PORT', '8090'))
BACKEND = os.getenv('PERSONAPLEX_BACKEND', 'offline').lower()
MODEL_LOADED = False


def build_silence_wav(path: Path, sample_rate: int = 24000, duration_s: float = 1.6) -> None:
  frames = int(sample_rate * duration_s)
  with wave.open(str(path), 'wb') as wav_file:
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    silence = struct.pack('<h', 0)
    wav_file.writeframes(silence * frames)


def build_tone_wav(path: Path, sample_rate: int = 22050, duration_s: float = 0.4, freq_hz: float = 440.0) -> None:
  frames = int(sample_rate * duration_s)
  with wave.open(str(path), 'wb') as wav_file:
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    for i in range(frames):
      sample = int(12000 * math.sin(2 * math.pi * freq_hz * i / sample_rate))
      wav_file.writeframes(struct.pack('<h', sample))


def run_personaplex_offline(payload: dict) -> bytes:
  global MODEL_LOADED

  repo_path = Path(os.getenv('PERSONAPLEX_REPO_PATH', '')).expanduser()
  if not repo_path or not repo_path.exists():
    raise RuntimeError('PERSONAPLEX_REPO_PATH is required and must point to a cloned nvidia/personaplex repo')

  voice_id = str(payload.get('voiceId') or 'NATF0').upper()
  sample_rate = int(payload.get('sampleRate') or 24000)
  text = str(payload.get('text') or '').strip()
  if not text:
    raise RuntimeError('text is required')

  persona_prompt = str(payload.get('personaPrompt') or '').strip()
  # Keep content unchanged; prepend persona as context line only.
  text_prompt = f"{persona_prompt}\n{text}" if persona_prompt else text

  with tempfile.TemporaryDirectory(prefix='personaplex-') as tmp:
    tmp_dir = Path(tmp)
    input_wav = tmp_dir / 'input.wav'
    output_wav = tmp_dir / 'output.wav'
    output_text = tmp_dir / 'output.json'

    build_silence_wav(input_wav, sample_rate=sample_rate)

    cmd = [
      'python',
      '-m',
      'moshi.offline',
      '--voice-prompt',
      f'{voice_id}.pt',
      '--text-prompt',
      text_prompt,
      '--input-wav',
      str(input_wav),
      '--output-wav',
      str(output_wav),
      '--output-text',
      str(output_text)
    ]

    extra_flags = os.getenv('PERSONAPLEX_OFFLINE_FLAGS', '').strip()
    if extra_flags:
      cmd.extend(extra_flags.split())

    result = subprocess.run(
      cmd,
      cwd=str(repo_path),
      env=os.environ.copy(),
      text=True,
      capture_output=True,
      check=False
    )

    if result.returncode != 0:
      raise RuntimeError(
        f'PersonaPlex offline failed (exit {result.returncode}). stderr: {result.stderr[-600:] or "<empty>"}'
      )

    if not output_wav.exists() or output_wav.stat().st_size < 64:
      raise RuntimeError('PersonaPlex offline completed but did not produce a valid wav file')

    MODEL_LOADED = True
    return output_wav.read_bytes()


class Handler(BaseHTTPRequestHandler):
  def _json(self, status: int, body: dict):
    encoded = json.dumps(body).encode('utf-8')
    self.send_response(status)
    self.send_header('Content-Type', 'application/json')
    self.send_header('Content-Length', str(len(encoded)))
    self.end_headers()
    self.wfile.write(encoded)

  def do_GET(self):
    if self.path != '/health':
      self._json(404, {'ok': False, 'error': 'not found'})
      return
    self._json(200, {'ok': True, 'provider': 'personaplex', 'backend': BACKEND, 'modelLoaded': MODEL_LOADED})

  def do_POST(self):
    if self.path != '/tts':
      self._json(404, {'ok': False, 'error': 'not found'})
      return

    content_len = int(self.headers.get('Content-Length', '0'))
    raw = self.rfile.read(content_len) if content_len > 0 else b'{}'

    try:
      payload = json.loads(raw.decode('utf-8'))
    except Exception:
      self._json(400, {'ok': False, 'error': 'invalid json'})
      return

    try:
      if BACKEND == 'mock':
        with tempfile.TemporaryDirectory(prefix='personaplex-mock-') as tmp:
          out = Path(tmp) / 'tone.wav'
          build_tone_wav(out)
          wav_data = out.read_bytes()
      else:
        wav_data = run_personaplex_offline(payload)
    except Exception as error:
      self._json(503, {'ok': False, 'error': str(error)})
      return

    self.send_response(200)
    self.send_header('Content-Type', 'audio/wav')
    self.send_header('Content-Length', str(len(wav_data)))
    self.end_headers()
    self.wfile.write(wav_data)


def main():
  server = HTTPServer((HOST, PORT), Handler)
  print(f'PersonaPlex wrapper listening on http://{HOST}:{PORT} using backend={BACKEND}')
  server.serve_forever()


if __name__ == '__main__':
  main()
