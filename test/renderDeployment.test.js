import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('mounts persistent Protesta media storage on the public API service', async () => {
  const renderConfig = await readFile(new URL('../render.yaml', import.meta.url), 'utf8');
  const apiService = renderConfig.split(/\n  - type: web\n/)[1];

  assert.match(apiService, /name: tonplaygram-bot\n/);
  assert.match(apiService, /mountPath: \/var\/data\/tonplaygram\n/);
  assert.match(apiService, /key: FLAMINGO_UPLOAD_DIR\n\s+value: \/var\/data\/tonplaygram\/flamingo-uploads\n/);
  assert.doesNotMatch(renderConfig, /https:\/\/tonplaygram-api\.onrender\.com/);
});
