#!/usr/bin/env python3
import base64
import io
import json
import math
import os
import struct
import urllib.request
import wave
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = os.getenv('PERSONAPLEX_SERVICE_HOST', '0.0.0.0')
PORT = int(os.getenv('PERSONAPLEX_SERVICE_PORT', '8090'))
REMOTE_URL = os.getenv('PERSONAPLEX_API_URL', '').rstrip('/')
REMOTE_PATH = os.getenv('PERSONAPLEX_SYNTHESIS_PATH', '/v1/speech/synthesize')
REMOTE_KEY = os.getenv('PERSONAPLEX_API_KEY', '')
MODEL_LOADED = False


def build_tone_wav(sample_rate: int, duration_s: float = 0.32, freq_hz: float = 440.0) -> bytes:
  frames = int(sample_rate * duration_s)
  pcm = io.BytesIO()
  with wave.open(pcm, 'wb') as wav_file:
    wav_file.setnchannels(1)
    wav_file.setsampwidth(2)
    wav_file.setframerate(sample_rate)
    for i in range(frames):
      sample = int(12000 * math.sin(2 * math.pi * freq_hz * i / sample_rate))
      wav_file.writeframes(struct.pack('<h', sample))
  return pcm.getvalue()


def call_remote_tts(payload: dict) -> bytes:
  global MODEL_LOADED
  if not REMOTE_URL:
    raise RuntimeError('PERSONAPLEX_API_URL is not configured')

  request_payload = {
    'input': payload.get('text', ''),
    'voice': payload.get('voiceId', 'NATF0'),
    'metadata': {
      'personaPrompt': payload.get('personaPrompt') or '',
      **(payload.get('metadata') or {})
    }
  }
  req = urllib.request.Request(
    f"{REMOTE_URL}{REMOTE_PATH if REMOTE_PATH.startswith('/') else '/' + REMOTE_PATH}",
    data=json.dumps(request_payload).encode('utf-8'),
    headers={
      'Content-Type': 'application/json',
      **({'Authorization': f'Bearer {REMOTE_KEY}'} if REMOTE_KEY else {})
    },
    method='POST'
  )

  with urllib.request.urlopen(req, timeout=30) as res:
    content_type = res.headers.get('Content-Type', '')
    body = res.read()
    MODEL_LOADED = True

  if 'audio/wav' in content_type:
    return body

  parsed = json.loads(body.decode('utf-8')) if body else {}
  audio_base64 = parsed.get('audioBase64') or parsed.get('audio_base64')
  if audio_base64:
    return base64.b64decode(audio_base64)
  raise RuntimeError('PersonaPlex response missing wav payload')


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
    self._json(200, {'ok': True, 'provider': 'personaplex', 'modelLoaded': MODEL_LOADED})

  def do_POST(self):
    if self.path != '/tts':
      self._json(404, {'ok': False, 'error': 'not found'})
      return
    content_len = int(self.headers.get('Content-Length', '0'))
    raw = self.rfile.read(content_len) if content_len > 0 else b'{}'
    payload = json.loads(raw.decode('utf-8'))
    sample_rate = int(payload.get('sampleRate') or 22050)

    try:
      wav_data = call_remote_tts(payload)
    except Exception:
      # Dev fallback tone keeps the API healthy if PersonaPlex is offline.
      wav_data = build_tone_wav(sample_rate=sample_rate)

    self.send_response(200)
    self.send_header('Content-Type', 'audio/wav')
    self.send_header('Content-Length', str(len(wav_data)))
    self.end_headers()
    self.wfile.write(wav_data)


def main():
  server = HTTPServer((HOST, PORT), Handler)
  print(f'PersonaPlex wrapper listening on http://{HOST}:{PORT}')
  server.serve_forever()


if __name__ == '__main__':
  main()
