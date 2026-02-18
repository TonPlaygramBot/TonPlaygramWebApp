#!/usr/bin/env python3
import argparse
import base64
import io
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = os.getenv('PERSONAPLEX_SERVICE_HOST', '0.0.0.0')
PORT = int(os.getenv('PERSONAPLEX_SERVICE_PORT', '8090'))
REMOTE_URL = os.getenv('PERSONAPLEX_API_URL', '').rstrip('/')
REMOTE_PATH = os.getenv('PERSONAPLEX_SYNTHESIS_PATH', '/v1/speech/synthesize')
HEALTH_PATH = os.getenv('PERSONAPLEX_HEALTH_PATH', '/health')
REMOTE_KEY = os.getenv('PERSONAPLEX_API_KEY', '')
STRICT_REMOTE = os.getenv('PERSONAPLEX_STRICT_REMOTE', '1') != '0'

MODEL_LOADED = False
LAST_ERROR = ''


def _remote_endpoint(path: str) -> str:
  normalized = path if path.startswith('/') else f'/{path}'
  return f"{REMOTE_URL}{normalized}"


def _request_json(url: str, method: str = 'GET', payload: dict | None = None, timeout: int = 45):
  headers = {
    'Content-Type': 'application/json'
  }
  if REMOTE_KEY:
    headers['Authorization'] = f'Bearer {REMOTE_KEY}'
  data = json.dumps(payload).encode('utf-8') if payload is not None else None
  req = urllib.request.Request(url, data=data, headers=headers, method=method)
  with urllib.request.urlopen(req, timeout=timeout) as res:
    body = res.read()
    content_type = res.headers.get('Content-Type', '')
  return content_type, body


def call_remote_tts(payload: dict) -> bytes:
  global MODEL_LOADED, LAST_ERROR
  if not REMOTE_URL:
    raise RuntimeError('PERSONAPLEX_API_URL is not configured')

  text = str(payload.get('text') or '').strip()
  if not text:
    raise RuntimeError('text is required')

  tts_payload_candidates = [
    {
      'input': text,
      'voice': payload.get('voiceId', 'NATF0'),
      'locale': payload.get('locale'),
      'metadata': {
        'personaPrompt': payload.get('personaPrompt') or '',
        **(payload.get('metadata') or {})
      }
    },
    {
      'text': text,
      'voice_id': payload.get('voiceId', 'NATF0'),
      'language': payload.get('locale'),
      'metadata': {
        'personaPrompt': payload.get('personaPrompt') or '',
        **(payload.get('metadata') or {})
      }
    }
  ]

  final_error = None
  for req_payload in tts_payload_candidates:
    try:
      content_type, body = _request_json(_remote_endpoint(REMOTE_PATH), method='POST', payload=req_payload)
      MODEL_LOADED = True
      LAST_ERROR = ''
      if 'audio/wav' in content_type or 'application/octet-stream' in content_type:
        return body
      parsed = json.loads(body.decode('utf-8')) if body else {}
      audio_base64 = parsed.get('audioBase64') or parsed.get('audio_base64')
      if audio_base64:
        return base64.b64decode(audio_base64)
      raise RuntimeError('PersonaPlex response missing wav payload')
    except Exception as err:
      final_error = err

  LAST_ERROR = str(final_error or 'PersonaPlex synthesis failed')
  raise RuntimeError(LAST_ERROR)


def probe_remote_health() -> tuple[bool, dict]:
  global MODEL_LOADED, LAST_ERROR
  if not REMOTE_URL:
    return False, {'ok': False, 'error': 'PERSONAPLEX_API_URL is not configured'}
  try:
    content_type, body = _request_json(_remote_endpoint(HEALTH_PATH), method='GET', payload=None, timeout=20)
    parsed = json.loads(body.decode('utf-8')) if 'json' in content_type and body else {}
    MODEL_LOADED = bool(parsed.get('modelLoaded', MODEL_LOADED))
    LAST_ERROR = ''
    return True, {
      'ok': True,
      'provider': 'personaplex',
      'modelLoaded': MODEL_LOADED,
      'remote': _remote_endpoint(HEALTH_PATH)
    }
  except Exception as err:
    LAST_ERROR = str(err)
    return False, {'ok': False, 'provider': 'personaplex', 'error': LAST_ERROR}


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
    healthy, payload = probe_remote_health()
    if healthy:
      self._json(200, payload)
    else:
      self._json(503, payload)

  def do_POST(self):
    if self.path != '/tts':
      self._json(404, {'ok': False, 'error': 'not found'})
      return
    content_len = int(self.headers.get('Content-Length', '0'))
    raw = self.rfile.read(content_len) if content_len > 0 else b'{}'
    payload = json.loads(raw.decode('utf-8'))

    try:
      wav_data = call_remote_tts(payload)
    except Exception as err:
      if STRICT_REMOTE:
        self._json(503, {'ok': False, 'provider': 'personaplex', 'error': str(err)})
        return
      self._json(503, {'ok': False, 'provider': 'personaplex', 'error': str(err), 'strictRemote': False})
      return

    self.send_response(200)
    self.send_header('Content-Type', 'audio/wav')
    self.send_header('Content-Length', str(len(wav_data)))
    self.end_headers()
    self.wfile.write(wav_data)


def main():
  parser = argparse.ArgumentParser(description='PersonaPlex wrapper service')
  parser.add_argument('--check', action='store_true', help='perform health check and exit')
  args = parser.parse_args()

  if args.check:
    healthy, payload = probe_remote_health()
    print(json.dumps(payload))
    raise SystemExit(0 if healthy else 1)

  server = HTTPServer((HOST, PORT), Handler)
  print(f'PersonaPlex wrapper listening on http://{HOST}:{PORT} (strict={STRICT_REMOTE})')
  server.serve_forever()


if __name__ == '__main__':
  main()
