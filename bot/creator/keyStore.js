import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync, chmodSync, openSync, writeFileSync, fsyncSync, closeSync, linkSync, unlinkSync, readFileSync } from 'node:fs';

const cached = new Map();
function decode(value) {
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32 || key.toString('base64') !== value.trim()) throw new Error('Invalid Creator Studio key');
  return key;
}

// Never use a temporary disk or a new key on every process start. The existing
// Render mount is durable and this private directory is outside public media.
export function creatorKey(env = process.env) {
  if (env.CREATOR_ENCRYPTION_KEY?.trim()) return decode(env.CREATOR_ENCRYPTION_KEY.trim());
  if (!env.FLAMINGO_PERSISTENT_MOUNT_PATH) throw new Error('Persistent key storage is not configured');
  const directory = path.resolve(env.FLAMINGO_PERSISTENT_MOUNT_PATH, 'creator-private');
  const filename = path.join(directory, 'encryption.key');
  if (cached.has(filename)) return cached.get(filename);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  let stored;
  try { stored = readFileSync(filename, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const temporary = path.join(directory, `.key-${crypto.randomUUID()}`);
    let fd;
    try {
      fd = openSync(temporary, 'wx', 0o600);
      writeFileSync(fd, crypto.randomBytes(32).toString('base64'));
      fsyncSync(fd); closeSync(fd); fd = undefined;
      // A hard link publishes the fully written key atomically without replacing
      // a key another process created during a rolling restart.
      try { linkSync(temporary, filename); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      stored = readFileSync(filename, 'utf8');
    } finally {
      if (fd !== undefined) closeSync(fd);
      try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  const key = decode(stored);
  chmodSync(filename, 0o600);
  cached.set(filename, key);
  return key;
}
