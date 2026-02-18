#!/usr/bin/env python3
import base64
import io
import json
import os
import urllib.request
import wave
from http.server import BaseHTTPRequestHandler, HTTPServer

HOST = os.getenv('PERSONAPLEX_SERVICE_HOST', '0.0.0.0')
PORT = int(os.getenv('PERSONAPLEX_SERVICE_PORT', '8787'))
UPSTREAM = os.getenv('PERSONAPLEX_UPSTREAM_URL', '').rstrip('/')
UPSTREAM_KEY = os.getenv('PERSONAPLEX_API_KEY', '')
UPSTREAM_PATH = os.getenv('PERSONAPLEX_UPSTREAM_SYNTH_PATH', '/v1/speech/synthesize')


def synthesize_fallback_wav(text: str, sample_rate: int = 22050) -> str:
    duration = max(0.25, min(1.2, len(text) / 120.0))
    frames = int(sample_rate * duration)
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wavf:
      wavf.setnchannels(1)
      wavf.setsampwidth(2)
      wavf.setframerate(sample_rate)
      wavf.writeframes(b'\x00\x00' * frames)
    return base64.b64encode(buffer.getvalue()).decode('ascii')


class Handler(BaseHTTPRequestHandler):
    def _json(self, code: int, payload: dict):
        data = json.dumps(payload).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == '/health':
            self._json(200, {
                'ok': True,
                'service': 'personaplex-wrapper',
                'modelLoaded': bool(UPSTREAM),
                'upstreamConfigured': bool(UPSTREAM)
            })
            return
        self._json(404, {'error': 'not found'})

    def do_POST(self):
        if self.path != '/tts':
            self._json(404, {'error': 'not found'})
            return

        length = int(self.headers.get('Content-Length', '0'))
        body = self.rfile.read(length) if length else b'{}'
        payload = json.loads(body.decode('utf-8') or '{}')
        text = str(payload.get('text') or '').strip()
        if not text:
            self._json(400, {'error': 'text is required'})
            return

        if UPSTREAM:
            try:
                req_data = json.dumps({
                    'input': text,
                    'voice': payload.get('voiceId'),
                    'persona_prompt': payload.get('personaPrompt'),
                    'locale': payload.get('locale')
                }).encode('utf-8')
                req = urllib.request.Request(
                    f"{UPSTREAM}{UPSTREAM_PATH if UPSTREAM_PATH.startswith('/') else '/' + UPSTREAM_PATH}",
                    data=req_data,
                    method='POST',
                    headers={
                        'Content-Type': 'application/json',
                        **({'Authorization': f'Bearer {UPSTREAM_KEY}'} if UPSTREAM_KEY else {})
                    }
                )
                with urllib.request.urlopen(req, timeout=30) as resp:
                    remote = json.loads(resp.read().decode('utf-8'))
                    self._json(200, {
                        'provider': 'nvidia-personaplex',
                        'audioBase64': remote.get('audioBase64') or remote.get('audio_base64'),
                        'audioUrl': remote.get('audioUrl') or remote.get('audio_url'),
                        'mimeType': remote.get('mimeType') or remote.get('mime_type') or 'audio/wav'
                    })
                    return
            except Exception as exc:
                self._json(502, {'error': f'upstream synthesis failed: {exc}'})
                return

        self._json(200, {
            'provider': 'personaplex-wrapper-fallback',
            'audioBase64': synthesize_fallback_wav(text, int(payload.get('sampleRate') or 22050)),
            'mimeType': 'audio/wav'
        })


if __name__ == '__main__':
    server = HTTPServer((HOST, PORT), Handler)
    print(f'PersonaPlex wrapper listening on http://{HOST}:{PORT}')
    server.serve_forever()
