import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import { createFlamingoObjectStorage } from '../utils/flamingoObjectStorage.js';

// Default is read-only. --probe writes and removes only one newly generated
// private diagnostic object; it never publishes a post or touches user media.
try {
  const store = createFlamingoObjectStorage();
  console.log(JSON.stringify(await store.health(), null, 2));
  if (process.argv.includes('--probe')) {
    const key = `wall-diagnostics/${randomUUID()}.bin`;
    const bytes = randomBytes(32);
    try {
      await store.put(key, bytes);
      const object = await store.head(key);
      if (object?.ContentLength !== bytes.length)
        throw new Error('Storage size verification failed.');
      const url = await store.readUrl(key);
      const response = await fetch(url, { headers: { Range: 'bytes=0-3' } });
      const range = Buffer.from(await response.arrayBuffer());
      if (response.status !== 206 || !range.equals(bytes.subarray(0, 4)))
        throw new Error('Playback range verification failed.');
      console.log(
        'Private object write, read and video byte-range checks passed.'
      );
    } finally {
      await store.remove(key);
    }
  }
} catch (error) {
  console.error(
    'Wall object storage check failed:',
    error.code || 'STORAGE_CHECK_FAILED',
    error.message
  );
  process.exitCode = 1;
}
