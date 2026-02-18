import { spawn } from 'node:child_process';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(url, retries = 20) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {}
    await wait(200);
  }
  throw new Error('health endpoint not ready');
}

describe('personaplex wrapper smoke', () => {
  test('health endpoint and wav header are valid', async () => {
    const proc = spawn('python3', ['services/personaplex_service/app.py'], {
      env: { ...process.env, PERSONAPLEX_SERVICE_PORT: '8791', PERSONAPLEX_UPSTREAM_URL: '' },
      stdio: 'ignore'
    });

    try {
      const healthRes = await waitForHealth('http://127.0.0.1:8791/health');
      expect(healthRes.ok).toBe(true);
      const health = await healthRes.json();
      expect(health.ok).toBe(true);

      const ttsRes = await fetch('http://127.0.0.1:8791/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Test phrase', voiceId: 'atlas_en_us_m', format: 'wav' })
      });
      expect(ttsRes.ok).toBe(true);
      const tts = await ttsRes.json();
      const wav = Buffer.from(tts.audioBase64, 'base64');
      expect(wav.slice(0, 4).toString('ascii')).toBe('RIFF');
      expect(wav.slice(8, 12).toString('ascii')).toBe('WAVE');
    } finally {
      proc.kill('SIGTERM');
    }
  });
});
