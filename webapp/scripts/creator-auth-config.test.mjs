import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { writeCreatorAuthConfig } from './write-creator-auth-config.mjs';

test('build-only Google client ID reaches the server config without exporting secrets', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'creator-public-auth-'));
  const previous = { ...process.env };
  t.after(async () => { for (const k of ['CREATOR_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID']) { if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k]; } await rm(root, { recursive: true, force: true }); });
  delete process.env.CREATOR_GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_ID; delete process.env.VITE_GOOGLE_CLIENT_ID;
  await mkdir(path.join(root, 'public'));
  await writeFile(path.join(root, '.env.production'), 'VITE_GOOGLE_CLIENT_ID=123456-test.apps.googleusercontent.com\nCREATOR_GOOGLE_CLIENT_SECRET=do-not-export\n');
  const output = await writeCreatorAuthConfig(root);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), { googleClientId: '123456-test.apps.googleusercontent.com' });
});
