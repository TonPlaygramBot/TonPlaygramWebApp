import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Protesta Shqiptare uses the working 08:00 disk playback configuration', async () => {
  const route = await readFile(new URL('../bot/routes/flamingoWall.js', import.meta.url), 'utf8');

  assert.match(route, /const uploadDirectory = path\.resolve\('data\/flamingo-uploads'\);/);
  assert.match(route, /res\.sendFile\(path\.join\(uploadDirectory, name\)/);
  assert.doesNotMatch(route, /GridFS|FLAMINGO_UPLOAD_DIR|flamingoStorage/);
});
