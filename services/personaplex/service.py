#!/usr/bin/env python3
import base64
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = os.getenv('PERSONAPLEX_SERVICE_HOST', '0.0.0.0')
PORT = int(os.getenv('PERSONAPLEX_SERVICE_PORT', '8090'))
REMOTE_URL = os.getenv('PERSONAPLEX_API_URL', '').rstrip('/')
REMOTE_PATH = os.getenv('PERSONAPLEX_SYNTHESIS_PATH', '/v1/speech/synthesize')
REMOTE_HEALTH_PATH = os.getenv('PERSONAPLEX_HEALTH_PATH', '/health')
REMOTE_KEY = os.getenv('PERSONAPLEX_API_KEY', '')
MODEL_LOADED = False
LAST_ERROR = None


def build_remote_request(payload: dict) -> list[dict]:
  text = str(payload.get('text', '')).strip()
  voice_id = str(payload.get('voiceId', 'NATF0')).strip() or 'NATF0'
  persona_prompt = payload.get('personaPrompt') or ''
  metadata = payload.get('metadata') or {}

  return [
    {
      'input': text,
      'voice': voice_id,
      'metadata': {'personaPrompt': persona_prompt, **metadata}
    },
    {
      'text': text,
      'voice_id': voice_id,
      'metadata': {'personaPrompt': persona_prompt, **metadata}
    },
    {
      'input': {'text': text},
      'voice': {'id': voice_id},
      'metadata': {'personaPrompt': persona_prompt, **metadata}
    }
  ]


def call_remote_tts(payload: dict) -> bytes:
  global MODEL_LOADED, LAST_ERROR
  if not REMOTE_URL:
    raise RuntimeError('PERSONAPLEX_API_URL is not configured')

  headers = {
    'Content-Type': 'application/json',
    **({'Authorization': f'Bearer {REMOTE_KEY}'} if REMOTE_KEY else {})
  }

  last_error = None
  for body in build_remote_request(payload):
    req = urllib.request.Request(
      f"{REMOTE_URL}{REMOTE_PATH if REMOTE_PATH.startswith('/') else '/' + REMOTE_PATH}",
      data=json.dumps(body).encode('utf-8'),
      headers=headers,
      method='POST'
    )

    try:
      with urllib.request.urlopen(req, timeout=60) as res:
        content_type = res.headers.get('Content-Type', '')
        response_body = res.read()
    except Exception as error:
      last_error = error
      continue

    if 'audio/wav' in content_type or 'application/octet-stream' in content_type:
      MODEL_LOADED = True
      LAST_ERROR = None
      return response_body

    parsed = json.loads(response_body.decode('utf-8')) if response_body else {}
    audio_base64 = parsed.get('audioBase64') or parsed.get('audio_base64')
    if audio_base64:
      MODEL_LOADED = True
      LAST_ERROR = None
      return base64.b64decode(audio_base64)

    last_error = RuntimeError('PersonaPlex response missing wav payload')

  LAST_ERROR = str(last_error) if last_error else 'unknown error'
  raise RuntimeError(f'PersonaPlex synthesis failed: {LAST_ERROR}')


def check_remote_health() -> tuple[bool, str]:
  if not REMOTE_URL:
    return False, 'PERSONAPLEX_API_URL is not configured'
  headers = {
    **({'Authorization': f'Bearer {REMOTE_KEY}'} if REMOTE_KEY else {})
  }
  req = urllib.request.Request(
    f"{REMOTE_URL}{REMOTE_HEALTH_PATH if REMOTE_HEALTH_PATH.startswith('/') else '/' + REMOTE_HEALTH_PATH}",
    headers=headers,
    method='GET'
  )
  try:
    with urllib.request.urlopen(req, timeout=15) as res:
      if 200 <= res.status < 300:
        return True, 'ok'
      return False, f'status {res.status}'
  except Exception as error:
    return False, str(error)


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

    remote_ok, detail = check_remote_health()
    status = 200 if remote_ok else 503
    self._json(status, {
      'ok': remote_ok,
      'provider': 'personaplex',
      'modelLoaded': MODEL_LOADED,
      'remoteConfigured': bool(REMOTE_URL),
      'remoteHealth': detail,
      'lastError': LAST_ERROR
    })

  def do_POST(self):
    if self.path != '/tts':
      self._json(404, {'ok': False, 'error': 'not found'})
      return

    content_len = int(self.headers.get('Content-Length', '0'))
    raw = self.rfile.read(content_len) if content_len > 0 else b'{}'
    try:
      payload = json.loads(raw.decode('utf-8'))
    except json.JSONDecodeError:
      self._json(400, {'ok': False, 'error': 'invalid json'})
      return

    text = str(payload.get('text', '')).strip()
    if not text:
      self._json(400, {'ok': False, 'error': 'text is required'})
      return

    try:
      wav_data = call_remote_tts(payload)
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
  print(f'PersonaPlex wrapper listening on http://{HOST}:{PORT}')
  server.serve_forever()


if __name__ == '__main__':
  main()
