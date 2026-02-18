import { spawn } from 'node:child_process';
import http from 'node:http';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(url, timeoutMs = 12000) {
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

const MINIMAL_WAV_BASE64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=';

describe('personaplex wrapper smoke', () => {
  let proc;
  let remote;

  beforeAll(async () => {
    remote = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.url === '/v1/speech/synthesize' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ audioBase64: MINIMAL_WAV_BASE64, mimeType: 'audio/wav' }));
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise((resolve) => remote.listen(18093, '127.0.0.1', resolve));

    proc = spawn('python3', ['services/personaplex/service.py'], {
      env: {
        ...process.env,
        PERSONAPLEX_SERVICE_PORT: '8092',
        PERSONAPLEX_API_URL: 'http://127.0.0.1:18093',
        PERSONAPLEX_SYNTHESIS_PATH: '/v1/speech/synthesize',
        PERSONAPLEX_HEALTH_PATH: '/health'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForHealth('http://127.0.0.1:8092/health');
  });

  afterAll(async () => {
    if (proc) proc.kill('SIGTERM');
    if (remote) await new Promise((resolve) => remote.close(resolve));
  });

  test('health is reachable', async () => {
    const res = await fetch('http://127.0.0.1:8092/health');
    expect(res.ok).toBe(true);
    const payload = await res.json();
    expect(payload.ok).toBe(true);
  });

  test('tts returns wav header', async () => {
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
