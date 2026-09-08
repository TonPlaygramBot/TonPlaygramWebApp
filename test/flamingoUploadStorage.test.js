import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  truncate,
  utimes,
  writeFile
} from 'node:fs/promises';
import {
  createFlamingoUploadStorage,
  uploadExpiryMs
} from '../bot/utils/flamingoUploadStorage.js';
import { flamingoUploadFailure } from '../bot/utils/flamingoUploadErrors.js';

describe('wall storage admission and expiry', () => {
  let directory, pending;
  const now = Date.now();
  const old = new Date(now - uploadExpiryMs - 1000);
  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'wall-capacity-'));
    pending = path.join(directory, '.pending');
    await mkdir(pending);
  });
  afterEach(() => rm(directory, { recursive: true, force: true }));
  const storage = (options = {}) =>
    createFlamingoUploadStorage({ directory, now: () => now, ...options });
  async function session({
    age = old,
    size = 8192,
    data = 'partial',
    metadata = {}
  } = {}) {
    const id = randomUUID();
    const part = path.join(pending, `${id}.part`);
    const meta = path.join(pending, `${id}.json`);
    await writeFile(part, data);
    await truncate(part, size);
    await writeFile(
      meta,
      JSON.stringify({
        id,
        name: 'phone.mp4',
        size,
        createdAt: age.getTime(),
        ...metadata
      })
    );
    await Promise.all([utimes(part, age, age), utimes(meta, age, age)]);
    return { id, part, meta };
  }
  test('reserves unwritten sparse bytes and preserves filesystem headroom', async () => {
    const file = await session({ size: 1024 ** 2 });
    const allocated = Math.min(
      (await lstat(file.part)).blocks * 512,
      1024 ** 2
    );
    const space = storage({
      reserveBytes: 100,
      filesystem: async () => ({
        bavail: 2 * 1024 ** 2,
        blocks: 4 * 1024 ** 2,
        bsize: 1
      })
    });
    expect(await space.inspect()).toMatchObject({
      reservedBytes: 1024 ** 2 - allocated,
      availableBytes: 1024 ** 2 + allocated - 100
    });
    await expect(space.assertCapacity(2 * 1024 ** 2)).rejects.toMatchObject({
      status: 507,
      code: 'WALL_DISK_FULL',
      retryable: false
    });
    await expect(space.assertCapacity(1024)).resolves.toHaveProperty(
      'availableBytes'
    );
  });
  test('expires abandoned originals but keeps active, recently touched and completed sessions', async () => {
    const abandoned = await session();
    const busy = await session();
    const fresh = await session({ metadata: { updatedAt: now } });
    const completed = await session({ metadata: { postId: 'published' } });
    const result = await storage({ isBusy: (id) => id === busy.id }).sweep();
    expect(result.removed).toBe(1);
    await expect(lstat(abandoned.part)).rejects.toMatchObject({
      code: 'ENOENT'
    });
    for (const file of [busy, fresh, completed])
      await expect(lstat(file.part)).resolves.toBeDefined();
  });

  test('reserves native staging space and expires abandoned native copies with their sessions', async () => {
    const size = 1024 ** 2;
    const file = await session({
      size,
      data: '',
      metadata: { nativeUploadSize: size }
    });
    const native = path.join(pending, `${file.id}.native`);
    await writeFile(native, '');
    await truncate(native, size);
    await utimes(native, old, old);
    const allocated =
      (await lstat(file.part)).blocks * 512 +
      (await lstat(native)).blocks * 512;
    expect((await storage().inspect()).reservedBytes).toBe(
      2 * size - allocated
    );
    expect((await storage().sweep()).removed).toBe(1);
    await expect(lstat(native)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('cleans old orphan native staging files without touching an active transfer', async () => {
    const id = randomUUID();
    const native = path.join(pending, `${id}.native`);
    await writeFile(native, 'partial native data');
    await utimes(native, old, old);
    expect(
      (await storage({ isBusy: (value) => value === id }).sweep()).removed
    ).toBe(0);
    expect((await storage().sweep()).removed).toBe(1);
    await expect(lstat(native)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  test('keeps acknowledged ranges when a chunk is recent even if the manifest is old', async () => {
    const file = await session();
    await utimes(file.part, new Date(now), new Date(now));
    expect((await storage().sweep()).removed).toBe(0);
    await expect(lstat(file.meta)).resolves.toBeDefined();
  });
  test('checks the public record before expiring a final file left by a failed save', async () => {
    const failed = await session();
    const published = await session();
    for (const file of [failed, published]) {
      await rm(file.part);
      await writeFile(path.join(directory, `${file.id}-phone.mp4`), 'original');
    }
    const isPublished = jest.fn(async (id) => id === published.id);
    expect((await storage({ isPublished }).sweep()).removed).toBe(1);
    expect(isPublished).toHaveBeenCalledTimes(2);
    await expect(
      lstat(path.join(directory, `${failed.id}-phone.mp4`))
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(
      readFile(path.join(directory, `${published.id}-phone.mp4`), 'utf8')
    ).resolves.toBe('original');
  });
  test('retains malformed metadata and files outside the upload-session namespace', async () => {
    const malformed = await session();
    await writeFile(malformed.meta, '{bad json');
    await utimes(malformed.meta, old, old);
    const unrelated = path.join(pending, 'notes.part');
    await writeFile(unrelated, 'keep');
    await utimes(unrelated, old, old);
    expect((await storage().sweep()).removed).toBe(0);
    await expect(lstat(malformed.part)).resolves.toBeDefined();
    await expect(readFile(unrelated, 'utf8')).resolves.toBe('keep');
  });
  test('reports database quota separately from disk and access failures', () => {
    expect(
      flamingoUploadFailure(
        new Error('you are over your space quota, using 514 MB of 512 MB')
      )
    ).toMatchObject({
      status: 507,
      code: 'WALL_DATABASE_QUOTA',
      retryable: false
    });
    expect(flamingoUploadFailure({ code: 'ENOSPC' })).toMatchObject({
      status: 507,
      code: 'WALL_DISK_FULL'
    });
    expect(flamingoUploadFailure({ code: 'EROFS' })).toMatchObject({
      status: 503,
      code: 'WALL_STORAGE_UNAVAILABLE'
    });
  });
});
