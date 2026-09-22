import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { creatorKey } from '../creator/keyStore.js';

test('a private persistent key survives fresh processes and does not touch public uploads', t => {
  const mount = mkdtempSync(path.join(tmpdir(), 'creator-key-'));
  t.after(() => rmSync(mount, { recursive: true, force: true }));
  const key = creatorKey({ FLAMINGO_PERSISTENT_MOUNT_PATH: mount });
  const filename = path.join(mount, 'creator-private/encryption.key');
  assert.equal(key.length, 32);
  assert.equal(statSync(filename).mode & 0o777, 0o600);
  assert.equal(statSync(path.dirname(filename)).mode & 0o777, 0o700);
  assert.equal(readFileSync(filename, 'utf8'), key.toString('base64'));
  const script = `import { creatorKey } from ${JSON.stringify(new URL('../creator/keyStore.js', import.meta.url).href)}; process.stdout.write(creatorKey({ FLAMINGO_PERSISTENT_MOUNT_PATH: process.argv[1] }).toString('base64'));`;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', script, mount], { encoding: 'utf8' }), key.toString('base64'));
});
test('explicit keys retain precedence; invalid keys and missing persistent storage fail closed', () => {
  const value = randomBytes(32).toString('base64');
  assert.equal(creatorKey({ CREATOR_ENCRYPTION_KEY: value }).toString('base64'), value);
  assert.throws(() => creatorKey({ CREATOR_ENCRYPTION_KEY: 'invalid', FLAMINGO_PERSISTENT_MOUNT_PATH: '/tmp' }));
  assert.throws(() => creatorKey({}));
});
test('a damaged existing key is never silently replaced', t => {
  const mount = mkdtempSync(path.join(tmpdir(), 'creator-damaged-key-'));
  t.after(() => rmSync(mount, { recursive: true, force: true }));
  const directory = path.join(mount, 'creator-private'); mkdirSync(directory);
  const filename = path.join(directory, 'encryption.key'); writeFileSync(filename, 'damaged');
  assert.throws(() => creatorKey({ FLAMINGO_PERSISTENT_MOUNT_PATH: mount }));
  assert.equal(readFileSync(filename, 'utf8'), 'damaged');
});
