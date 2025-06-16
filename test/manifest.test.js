import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { spawn } from 'child_process';
import { setTimeout as delay } from 'timers/promises';
import { runInNewContext } from 'vm';

const distDir = new URL('../webapp/dist/', import.meta.url);

async function startServer(env) {
  return spawn('node', ['bot/server.js'], { env, stdio: 'pipe' });
}

test('server exposes manifest endpoint from TONCONNECT_MANIFEST_URL', async () => {
  fs.mkdirSync(new URL('assets', distDir), { recursive: true });
  fs.writeFileSync(new URL('index.html', distDir), '');

  const env = {
    ...process.env,
    PORT: '3100',
    MONGODB_URI: 'memory',
    SKIP_BOT_LAUNCH: '1',
    SKIP_WEBAPP_BUILD: '1',
    TONCONNECT_MANIFEST_URL: '/test-manifest.json'
  };
  const server = await startServer(env);
  try {
    for (let i = 0; i < 20; i++) {
      try {
        const res = await fetch('http://localhost:3100/test-manifest.json');
        if (res.ok) {
          const data = await res.json();
          assert.equal(data.name, 'TonPlaygram');
          return;
        }
      } catch {}
      await delay(100);
    }
    assert.fail('manifest endpoint not reachable');
  } finally {
    server.kill();
  }
});

test('manifestUrl uses VITE_TONCONNECT_MANIFEST when provided', () => {
  const src = fs.readFileSync('webapp/src/main.jsx', 'utf8');
  const match = src.match(/const manifestUrl[\s\S]*?;/);
  assert(match, 'manifestUrl definition missing');
  const context = {
    env: { VITE_TONCONNECT_MANIFEST: 'https://example.com/m.json', VITE_API_BASE_URL: 'http://api' },
    window: { location: { origin: 'http://host' } }
  };
  runInNewContext(match[0].replace(/import\.meta\.env/g, 'env') + '; result = manifestUrl;', context);
  assert.equal(context.result, 'https://example.com/m.json');
});
