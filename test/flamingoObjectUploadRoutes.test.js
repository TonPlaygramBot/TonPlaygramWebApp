import express from 'express';
import { randomUUID, createHash } from 'node:crypto';
import {
  uploadWallFile,
  wallRequest
} from '../webapp/src/features/flamingo/wallUpload.js';

const mockSessions = new Map();
const mockPosts = [];
const mockMultiparts = new Map();
const mockObjects = new Map();
const mockDirectRequests = [];
let mockBase;
let mockSaveFailure = false;
const mockQuery = (read) => {
  const query = {
    select: () => query,
    lean: async () => read(),
    then: (resolve) => resolve(read())
  };
  return query;
};
const mockMatches = (post, query) =>
  Object.entries(query).every(([key, expected]) => {
    if (key === '$or') return expected.some((part) => mockMatches(post, part));
    const actual = key
      .split('.')
      .reduce((value, field) => value?.[field], post);
    return expected instanceof RegExp
      ? expected.test(actual)
      : actual === expected;
  });
function mockSet(record, values) {
  for (const [key, value] of Object.entries(values)) {
    const keys = key.split('.');
    let target = record;
    while (keys.length > 1) {
      const field = keys.shift();
      target = target[field] ||= {};
    }
    target[keys[0]] = value;
  }
  record.updatedAt = new Date();
  return record;
}
jest.mock('../bot/models/FlamingoMediaUpload.js', () => ({
  __esModule: true,
  default: {
    findById: (id) => mockQuery(() => mockSessions.get(id)),
    findByIdAndUpdate: (id, update) =>
      mockQuery(() => mockSet(mockSessions.get(id), update.$set)),
    create: async (value) => {
      if (mockSessions.has(value._id))
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      const record = { ...value, createdAt: new Date(), updatedAt: new Date() };
      mockSessions.set(value._id, record);
      return record;
    },
    updateOne: async (query, update) =>
      mockSet(mockSessions.get(query._id), update.$set)
  }
}));
jest.mock('../bot/models/FlamingoPost.js', () => ({
  __esModule: true,
  default: {
    exists: async (query) => mockPosts.some((post) => mockMatches(post, query)),
    findOne: (query) =>
      mockQuery(() => mockPosts.find((post) => mockMatches(post, query))),
    findById: (id) =>
      mockQuery(() => mockPosts.find((post) => post._id === String(id))),
    findOneAndUpdate: (query, update) =>
      mockQuery(() => {
        if (mockSaveFailure) {
          mockSaveFailure = false;
          throw new Error('Database save interrupted');
        }
        const existing = mockPosts.find((post) => mockMatches(post, query));
        if (existing)
          return update.$set ? mockSet(existing, update.$set) : existing;
        if (!update.$setOnInsert) return null;
        const post = {
          ...update.$setOnInsert,
          _id: String(mockPosts.length + 1).padStart(24, '0'),
          createdAt: new Date().toISOString()
        };
        post.deleteOne = async () =>
          mockPosts.splice(mockPosts.indexOf(post), 1);
        mockPosts.push(post);
        return post;
      })
  }
}));
const mockStore = {
  bucket: 'private-wall',
  health: async () => ({
    provider: 's3',
    reachable: true,
    durability: { persistent: true, required: true }
  }),
  head: async (key) =>
    mockObjects.has(key)
      ? { ContentLength: mockObjects.get(key).length }
      : null,
  remove: jest.fn(async (key) => mockObjects.delete(key)),
  begin: async (key) => {
    const id = randomUUID();
    mockMultiparts.set(id, { key, parts: new Map() });
    return id;
  },
  abort: async (session) => mockMultiparts.delete(session.multipartId),
  signPart: async (session, number, size) =>
    `${mockBase}/bucket/parts/${session.multipartId}/${number}?size=${size}`,
  part: async (session, number) =>
    mockMultiparts.get(session.multipartId)?.parts.get(number),
  parts: async (session) => [
    ...mockMultiparts.get(session.multipartId).parts.values()
  ],
  complete: jest.fn(async (session, receipts) => {
    const upload = mockMultiparts.get(session.multipartId);
    const bytes = Buffer.concat(
      receipts.map((receipt) => upload.parts.get(receipt.number).bytes)
    );
    mockObjects.set(session.key, bytes);
    mockMultiparts.delete(session.multipartId);
    return { ContentLength: bytes.length };
  }),
  readUrl: async (key) => `${mockBase}/bucket/files/${encodeURIComponent(key)}`
};
jest.mock('../bot/utils/flamingoObjectStorage.js', () => ({
  ...jest.requireActual('../bot/utils/flamingoObjectStorage.js'),
  flamingoObjectStorage: () => mockStore
}));
// Object uploads must work without even attempting filesystem admission.
jest.mock('node:fs/promises', () => ({
  ...jest.requireActual('node:fs/promises'),
  statfs: jest.fn(() => {
    throw new Error('Render disk unavailable');
  })
}));

describe('direct object media uploads over HTTP', () => {
  let server, base;
  const owner = { 'X-Wall-Owner-Token': 'private-test-owner' };
  const previousMode = process.env.FLAMINGO_MEDIA_STORAGE;
  async function startServer() {
    const { default: router } = await import('../bot/routes/flamingoWall.js');
    const app = express();
    app.put(
      '/bucket/parts/:upload/:part',
      express.raw({ type: '*/*', limit: '6mb' }),
      (req, res) => {
        const upload = mockMultiparts.get(req.params.upload);
        if (!upload || req.body.length !== Number(req.query.size))
          return res.status(400).end();
        mockDirectRequests.push({
          headers: req.headers,
          size: req.body.length
        });
        const ETag = `"${createHash('sha256').update(req.body).digest('hex')}"`;
        upload.parts.set(Number(req.params.part), {
          PartNumber: Number(req.params.part),
          Size: req.body.length,
          ETag,
          bytes: req.body
        });
        res.setHeader('ETag', ETag);
        res.status(200).end();
      }
    );
    app.get('/bucket/files/:key', (req, res) => {
      const bytes = mockObjects.get(req.params.key);
      if (!bytes) return res.status(404).end();
      res.type('video/mp4');
      res.setHeader('Accept-Ranges', 'bytes');
      const range = /^bytes=(\d+)-(\d+)$/.exec(req.get('Range') || '');
      if (range) {
        res.status(206);
        res.setHeader(
          'Content-Range',
          `bytes ${range[1]}-${range[2]}/${bytes.length}`
        );
        return res.send(bytes.subarray(Number(range[1]), Number(range[2]) + 1));
      }
      res.send(bytes);
    });
    app.use('/api/flamingo-wall', router);
    server = await new Promise((resolve) => {
      const active = app.listen(0, '127.0.0.1', () => resolve(active));
    });
    mockBase = `http://127.0.0.1:${server.address().port}`;
    base = `${mockBase}/api/flamingo-wall`;
  }
  beforeAll(async () => {
    process.env.FLAMINGO_MEDIA_STORAGE = 's3';
    await startServer();
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (previousMode === undefined) delete process.env.FLAMINGO_MEDIA_STORAGE;
    else process.env.FLAMINGO_MEDIA_STORAGE = previousMode;
  });
  beforeEach(() => {
    mockSessions.clear();
    mockPosts.length = 0;
    mockObjects.clear();
    mockMultiparts.clear();
    mockDirectRequests.length = 0;
    mockSaveFailure = false;
    mockStore.complete.mockClear();
    mockStore.remove.mockClear();
  });
  const makeFile = (size) =>
    Object.assign(new Blob([Buffer.alloc(size, 7)], { type: 'video/mp4' }), {
      name: 'phone.mp4'
    });
  const publish = (file, id = randomUUID(), extra = {}) =>
    uploadWallFile({
      baseUrl: mockBase,
      file,
      headers: owner,
      uploadId: id,
      text: 'My video',
      title: '',
      ...extra
    });

  test('publishes through direct multipart requests, preserves original bytes and redirects seeking to the bucket', async () => {
    const file = makeFile(5 * 1024 ** 2 + 8);
    const { post } = await publish(file);
    expect(post.canManage).toBe(true);
    expect(post.ownerTokenHash).toBeUndefined();
    expect(post.attachment).toMatchObject({
      size: file.size,
      objectBucket: 'private-wall'
    });
    expect(mockDirectRequests.map((request) => request.size)).toEqual([
      5 * 1024 ** 2,
      8
    ]);
    for (const request of mockDirectRequests) {
      expect(request.headers['x-wall-owner-token']).toBeUndefined();
      expect(request.headers.authorization).toBeUndefined();
    }
    const redirect = await fetch(mockBase + post.attachment.url, {
      redirect: 'manual'
    });
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get('Cache-Control')).toBe('no-store');
    const video = await fetch(mockBase + post.attachment.url, {
      headers: { Range: 'bytes=1-3' }
    });
    expect(video.status).toBe(206);
    expect(Buffer.from(await video.arrayBuffer())).toEqual(Buffer.alloc(3, 7));
    const health = await (await fetch(`${base}/health`)).json();
    expect(health).toMatchObject({
      mediaStorage: 'available',
      storage: { provider: 's3' }
    });
  });

  test('denies another owner and rejects acknowledgements that disagree with the provider', async () => {
    const id = randomUUID();
    await fetch(`${base}/uploads`, {
      method: 'POST',
      headers: {
        ...owner,
        'Content-Type': 'application/json',
        'X-Upload-Id': id
      },
      body: JSON.stringify({ name: 'phone.mp4', size: 5 })
    });
    const denied = await fetch(`${base}/uploads/${id}/parts/1/sign`, {
      method: 'POST',
      headers: { 'X-Wall-Owner-Token': 'other-owner' }
    });
    expect(denied.status).toBe(403);
    const ack = await fetch(`${base}/uploads/${id}/parts/1/ack`, {
      method: 'POST',
      headers: { ...owner, 'Content-Type': 'application/json' },
      body: JSON.stringify({ etag: 'invented' })
    });
    expect(ack.status).toBe(409);
    const complete = await fetch(`${base}/uploads/${id}/complete`, {
      method: 'POST',
      headers: owner
    });
    expect(complete.status).toBe(409);
    expect(mockPosts).toHaveLength(0);
  });

  test('download grants and author deletion resolve the exact private object', async () => {
    const post = (await publish(makeFile(5))).post;
    expect(
      (await fetch(mockBase + post.attachment.url + '?download=1')).status
    ).toBe(403);
    const grant = await (
      await fetch(`${base}/posts/${post._id}/download`, { method: 'POST' })
    ).json();
    expect(grant.price).toBe(0);
    const download = await fetch(mockBase + grant.downloadUrl);
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer())).toEqual(
      Buffer.alloc(5, 7)
    );
    expect((await fetch(`${base}/downloads/invalid`)).status).toBe(403);
    expect(
      (
        await fetch(`${base}/posts/${post._id}`, {
          method: 'DELETE',
          headers: { 'X-Wall-Owner-Token': 'other-owner' }
        })
      ).status
    ).toBe(403);
    expect(mockObjects.has(post.attachment.objectKey)).toBe(true);
    expect(
      (
        await fetch(`${base}/posts/${post._id}`, {
          method: 'DELETE',
          headers: owner
        })
      ).status
    ).toBe(204);
    expect(mockStore.remove).toHaveBeenCalledWith(
      post.attachment.objectKey,
      post.attachment.objectBucket
    );
    expect(mockObjects.has(post.attachment.objectKey)).toBe(false);
  });

  test('a failed post save resumes from the completed original and never uploads or creates it twice', async () => {
    mockSaveFailure = true;
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const id = randomUUID();
      const { post } = await publish(makeFile(5), id);
      expect(post._id).toBeDefined();
      expect(mockStore.complete).toHaveBeenCalledTimes(1);
      const again = await publish(makeFile(5), id);
      expect(again.post._id).toBe(post._id);
      expect(mockPosts).toHaveLength(1);
      expect(mockDirectRequests).toHaveLength(1);
    } finally {
      errorLog.mockRestore();
    }
  });

  test('restores a missing original into the same post using object storage', async () => {
    const original = (await publish(makeFile(5))).post;
    mockObjects.delete(original.attachment.objectKey);
    const restored = (
      await publish(makeFile(5), randomUUID(), {
        restorePostId: original._id,
        text: 'Do not replace my caption'
      })
    ).post;
    expect(restored).toMatchObject({
      _id: original._id,
      text: original.text,
      createdAt: original.createdAt
    });
    expect(restored.attachment.objectKey).not.toBe(
      original.attachment.objectKey
    );
    expect(mockPosts).toHaveLength(1);
  });

  test('confirmed posts and pending upload manifests survive API process reinitialization', async () => {
    const id = randomUUID();
    const post = (await publish(makeFile(5), id)).post;
    const pendingId = randomUUID();
    const file = makeFile(5 * 1024 ** 2 + 8);
    const controller = new AbortController();
    await expect(
      publish(file, pendingId, {
        signal: controller.signal,
        send: async (url, init, options) => {
          const result = await wallRequest(url, init, options);
          if (url.endsWith('/parts/1/ack')) controller.abort();
          return result;
        }
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(mockPosts).toHaveLength(1);
    await new Promise((resolve) => server.close(resolve));
    jest.resetModules();
    await startServer();
    expect((await publish(makeFile(5), id)).post._id).toBe(post._id);
    expect((await publish(file, pendingId)).post.attachment.size).toBe(
      file.size
    );
    expect((await fetch(mockBase + post.attachment.url)).status).toBe(200);
    expect(mockDirectRequests.map((request) => request.size)).toEqual([
      5,
      5 * 1024 ** 2,
      8
    ]);
  });
});
