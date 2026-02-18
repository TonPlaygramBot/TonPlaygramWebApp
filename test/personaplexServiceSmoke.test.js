import { spawn } from 'node:child_process';
import http from 'node:http';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const WAV_BASE64 =
  'UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';

async function waitForHealth(url, timeoutMs = 10000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await wait(200);
  }
  throw new Error('health endpoint was not reachable in time');
}

describe('personaplex wrapper smoke', () => {
  let proc;
  let remoteServer;

  beforeAll(async () => {
    remoteServer = http.createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, modelLoaded: true }));
        return;
      }

      if (req.url === '/v1/speech/synthesize' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ audioBase64: WAV_BASE64, mimeType: 'audio/wav' }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false }));
    });

    await new Promise((resolve) => remoteServer.listen(18091, resolve));

    proc = spawn('python3', ['services/personaplex/service.py'], {
      env: {
        ...process.env,
        PERSONAPLEX_SERVICE_PORT: '8092',
        PERSONAPLEX_API_URL: 'http://127.0.0.1:18091',
        PERSONAPLEX_STRICT_REMOTE: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    await waitForHealth('http://127.0.0.1:8092/health');
  });

  afterAll(async () => {
    if (proc) proc.kill('SIGTERM');
    if (remoteServer) {
      await new Promise((resolve) => remoteServer.close(resolve));
    }
  });

  test('health is reachable and model is loaded', async () => {
    const res = await fetch('http://127.0.0.1:8092/health');
    expect(res.ok).toBe(true);
    const payload = await res.json();
    expect(payload.ok).toBe(true);
    expect(payload.modelLoaded).toBe(true);
  });

  test('tts returns wav header from remote personaplex payload', async () => {
    const res = await fetch('http://127.0.0.1:8092/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'short commentary line', voiceId: 'NATM1', format: 'wav' })
    });
    expect(res.ok).toBe(true);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(buf.subarray(8, 12).toString('ascii')).toBe('WAVE');
  });
});
