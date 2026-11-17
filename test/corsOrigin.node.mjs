import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAllowedApiOrigin } from '../bot/utils/corsOrigin.js';

const configuredIosOrigin = 'capacitor://tonplaygram-bot.onrender.com';

test('configured iOS origin is allowed in production with empty or populated web allowlist', () => {
  assert.equal(isAllowedApiOrigin(configuredIosOrigin, [], true), true);
  assert.equal(isAllowedApiOrigin(configuredIosOrigin, ['https://tonplaygram.com'], true), true);
});

test('explicit allowlist matches the checked-in Capacitor hostname and default iOS scheme', () => {
  const config = readFileSync(new URL('../webapp/capacitor.config.ts', import.meta.url), 'utf8');
  assert.match(config, /hostname:\s*'tonplaygram-bot\.onrender\.com'/);
  // If a future change sets iosScheme, review the exact-origin contract again.
  assert.doesNotMatch(config, /iosScheme\s*:/);
});

test('native schemes and hostname lookalikes remain denied in production', () => {
  for (const origin of [
    'capacitor://example.com',
    'capacitor://tonplaygram-bot.onrender.com.evil.example',
    'capacitor://tonplaygram-bot.onrender.com:443',
    'capacitor://tonplaygram-bot.onrender.com/',
    'capacitor://user@tonplaygram-bot.onrender.com',
    'ionic://tonplaygram-bot.onrender.com',
    'http://tonplaygram-bot.onrender.com',
    'https://evil.example',
    'null'
  ]) assert.equal(isAllowedApiOrigin(origin, [], true), false, origin);
});

test('existing native and configured web origins and no-Origin behavior are unchanged', () => {
  for (const origin of ['capacitor://localhost', 'ionic://localhost', 'http://localhost', undefined]) {
    assert.equal(isAllowedApiOrigin(origin, [], true), true);
  }
  assert.equal(isAllowedApiOrigin('https://tonplaygram.com', ['https://tonplaygram.com'], true), true);
  assert.equal(isAllowedApiOrigin('https://example.com', [], true), false);
});

test('development loopback behavior remains unchanged', () => {
  assert.equal(isAllowedApiOrigin('http://127.0.0.1:5173', [], false), true);
  assert.equal(isAllowedApiOrigin('http://127.0.0.1:5173', [], true), false);
  assert.equal(isAllowedApiOrigin('http://localhost:4173', [], false), true);
});
