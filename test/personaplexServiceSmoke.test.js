import { spawn } from 'node:child_process';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(url, timeoutMs = 8000) {
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

  beforeAll(async () => {
    proc = spawn('python3', ['services/personaplex/service.py'], {
      env: { ...process.env, PERSONAPLEX_SERVICE_PORT: '8092', PERSONAPLEX_BACKEND: 'mock' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitForHealth('http://127.0.0.1:8092/health');
  });

  afterAll(() => {
    if (proc) proc.kill('SIGTERM');
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
