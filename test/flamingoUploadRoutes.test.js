import express from 'express';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { Writable } from 'node:stream';

const compression = createRequire(path.resolve('bot/package.json'))(
  'compression'
);
const mockFilesystem = jest.fn();
jest.mock('node:fs/promises', () => ({
  ...jest.requireActual('node:fs/promises'),
  statfs: (...args) => mockFilesystem(...args)
}));

const mockPosts = [];
const mockCreate = jest.fn(async (content) => {
  const post = {
    ...content,
    _id: String(mockPosts.length + 1).padStart(24, '0'),
    createdAt: new Date().toISOString()
  };
  mockPosts.push(post);
  return post;
});
function mockMatches(post, query) {
  if (query.$or) return query.$or.some((part) => mockMatches(post, part));
  return Object.entries(query).every(([key, expected]) => {
    const value = key.split('.').reduce((item, field) => item?.[field], post);
    return expected instanceof RegExp
      ? expected.test(value)
      : expected?.$regex
        ? expected.$regex.test(value)
        : value === expected;
  });
}
jest.mock('../bot/models/FlamingoPost.js', () => ({
  __esModule: true,
  default: {
    create: (...args) => mockCreate(...args),
    findOne: (query) => ({
      lean: async () =>
        mockPosts.find((post) => mockMatches(post, query)) || null
    }),
    findById: (id) => ({
      lean: async () => mockPosts.find((post) => post._id === id) || null
    }),
    findOneAndUpdate: (query, update) => ({
      lean: async () =>
        mockPosts.find((post) => mockMatches(post, query)) ||
        mockCreate(update.$setOnInsert)
    })
  }
}));

describe('wall HTTP upload and publication', () => {
  let server, base, directory;
  const oldDirectory = process.env.FLAMINGO_UPLOAD_DIR;
  const oldBackup = process.env.FLAMINGO_GRIDFS_BACKUP;
  const oldChunk = process.env.FLAMINGO_UPLOAD_CHUNK_BYTES;
  const owner = { 'X-Wall-Owner-Token': 'test-phone-owner' };
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'wall-upload-test-'));
    process.env.FLAMINGO_UPLOAD_DIR = directory;
    process.env.FLAMINGO_GRIDFS_BACKUP = 'false';
    process.env.FLAMINGO_UPLOAD_CHUNK_BYTES = String(1024 ** 2);
    const { default: router } = await import('../bot/routes/flamingoWall.js');
    const app = express();
    app.use(compression());
    app.use('/api/flamingo-wall', router);
    server = await new Promise((resolve) => {
      const active = app.listen(0, '127.0.0.1', () => resolve(active));
    });
    base = `http://127.0.0.1:${server.address().port}/api/flamingo-wall`;
  });
  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (directory) await rm(directory, { recursive: true, force: true });
    for (const [key, value] of [
      ['FLAMINGO_UPLOAD_DIR', oldDirectory],
      ['FLAMINGO_GRIDFS_BACKUP', oldBackup],
      ['FLAMINGO_UPLOAD_CHUNK_BYTES', oldChunk]
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  beforeEach(() => {
    mockPosts.length = 0;
    mockCreate.mockClear();
    mockFilesystem.mockImplementation(
      jest.requireActual('node:fs/promises').statfs
    );
  });
  const start = (id, metadata) =>
    fetch(`${base}/uploads`, {
      method: 'POST',
      headers: {
        ...owner,
        'X-Upload-Id': id,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });
  const put = (id, offset, body, headers = owner) =>
    fetch(`${base}/uploads/${id}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/octet-stream',
        'X-Upload-Offset': String(offset)
      },
      body
    });

  test('uploads original video bytes, resumes after interruption, and serves seekable media', async () => {
    const id = randomUUID();
    const bytes = Buffer.alloc(1024 ** 2 + 11, 7);
    bytes.write('phone video');
    const metadata = {
      name: 'phone.mp4',
      size: bytes.length,
      type: 'video/mp4',
      text: 'My video'
    };
    expect((await start(id, metadata)).status).toBe(201);
    expect((await put(id, 0, bytes.subarray(0, 1024 ** 2))).status).toBe(200);
    const resumed = await (await start(id, metadata)).json();
    expect(resumed.receivedOffsets).toEqual([0]);
    expect(resumed.received).toBe(1024 ** 2);
    expect((await put(id, 1024 ** 2, bytes.subarray(1024 ** 2))).status).toBe(
      200
    );
    const complete = () =>
      fetch(`${base}/uploads/${id}/complete`, {
        method: 'POST',
        headers: owner
      });
    const results = await Promise.all([complete(), complete()]);
    const [first, second] = await Promise.all(
      results.map((response) => response.json())
    );
    expect(first.post._id).toBe(second.post._id);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(await readFile(path.join(directory, `${id}-phone.mp4`))).toEqual(
      bytes
    );
    const playback = await fetch(`${base}/files/${id}-phone.mp4`, {
      headers: { Range: 'bytes=0-10' }
    });
    expect(playback.status).toBe(206);
    expect(playback.headers.get('content-type')).toContain('video/mp4');
    expect(Buffer.from(await playback.arrayBuffer())).toEqual(
      bytes.subarray(0, 11)
    );
    const retry = await (await start(id, metadata)).json();
    expect(retry.post._id).toBe(first.post._id);
  }, 15000);

  test('publishes an 8,000-character Unicode article with its photo without dropping the body', async () => {
    const id = randomUUID();
    const text = '📰ë'.repeat(2000) + 'ë'.repeat(2000);
    expect(text.length).toBe(8000);
    expect(
      (
        await start(id, {
          name: 'cover.jpg',
          size: 5,
          type: 'image/jpeg',
          text,
          title: 'A community article'
        })
      ).status
    ).toBe(201);
    expect((await put(id, 0, Buffer.from('photo'))).status).toBe(200);
    const response = await fetch(`${base}/uploads/${id}/complete`, {
      method: 'POST',
      headers: owner
    });
    const { post } = await response.json();
    expect(post.text).toBe(text);
    expect(post.title).toBe('A community article');
    expect(post.attachment.type).toBe('image/jpeg');
  });

  test('rejects another owner and refuses to publish an incomplete file', async () => {
    const id = randomUUID();
    await start(id, { name: 'clip.mp4', size: 5, type: 'video/mp4' });
    expect(
      (
        await put(id, 0, Buffer.from('other'), {
          'X-Wall-Owner-Token': 'another-phone'
        })
      ).status
    ).toBe(403);
    const unauthorized = await fetch(`${base}/uploads/${id}/complete`, {
      method: 'POST',
      headers: { 'X-Wall-Owner-Token': 'another-phone' }
    });
    expect(unauthorized.status).toBe(403);
    const incomplete = await fetch(`${base}/uploads/${id}/complete`, {
      method: 'POST',
      headers: owner
    });
    expect(incomplete.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('retries text articles safely and accepts Unicode bodies larger than 16 KB', async () => {
    const text = '界'.repeat(8000);
    const body = JSON.stringify({
      clientId: randomUUID(),
      title: 'Long article',
      text
    });
    const send = () =>
      fetch(`${base}/posts/content`, {
        method: 'POST',
        headers: { ...owner, 'Content-Type': 'application/json' },
        body
      });
    const first = await (await send()).json();
    const retry = await (await send()).json();
    expect(first.post.text).toBe(text);
    expect(retry.post._id).toBe(first.post._id);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test('refuses an upload before creating a part when capacity is exhausted and reports that capacity', async () => {
    mockFilesystem.mockResolvedValue({ bavail: 0, bsize: 1, blocks: 1000 });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const id = randomUUID();
    try {
      const response = await start(id, {
        name: 'large.mp4',
        size: 555 * 1024 ** 2,
        type: 'video/mp4'
      });
      expect(response.status).toBe(507);
      expect(await response.json()).toMatchObject({
        code: 'WALL_DISK_FULL',
        retryable: false
      });
      await expect(
        readFile(path.join(directory, '.pending', `${id}.part`))
      ).rejects.toMatchObject({ code: 'ENOENT' });
      const health = await (await fetch(`${base}/health`)).json();
      expect(health).toMatchObject({
        mediaStorage: 'full',
        storage: { freeBytes: 0, availableBytes: 0, backup: 'disk' }
      });
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  test('sends the live-feed connection and changes immediately through compression middleware', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch(`${base}/events`, {
        signal: controller.signal,
        headers: { 'Accept-Encoding': 'gzip' }
      });
      expect(response.headers.get('content-encoding')).toBeNull();
      const reader = response.body.getReader();
      expect(new TextDecoder().decode((await reader.read()).value)).toContain(
        ': connected'
      );
      await fetch(`${base}/posts/content`, {
        method: 'POST',
        headers: { ...owner, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'A live update', clientId: randomUUID() })
      });
      expect(new TextDecoder().decode((await reader.read()).value)).toContain(
        'event: wall-change'
      );
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  });

  test('returns a disk-full response for a failed chunk and resumes the same session after recovery', async () => {
    const id = randomUUID();
    await start(id, { name: 'phone.jpg', size: 5, type: 'image/jpeg' });
    const write = jest
      .spyOn(jest.requireActual('fs'), 'createWriteStream')
      .mockImplementationOnce(
        () =>
          new Writable({
            write(_chunk, _encoding, done) {
              done(
                Object.assign(new Error('No space left on device'), {
                  code: 'ENOSPC'
                })
              );
            }
          })
      );
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const failed = await put(id, 0, Buffer.from('photo'));
      expect(failed.status).toBe(507);
      expect(await failed.json()).toMatchObject({
        code: 'WALL_DISK_FULL',
        retryable: false
      });
      expect(
        JSON.parse(
          await readFile(path.join(directory, '.pending', `${id}.json`), 'utf8')
        ).received
      ).toBe(0);
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      write.mockRestore();
      log.mockRestore();
    }
    expect((await put(id, 0, Buffer.from('photo'))).status).toBe(200);
    const response = await fetch(`${base}/uploads/${id}/complete`, {
      method: 'POST',
      headers: owner
    });
    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
