import express from 'express';
import path from 'node:path';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

let mockPost;
let mockUsers;
const mockCharge = jest.fn(async (query, update) => {
  const user = mockUsers[query._id];
  const transaction = update.$push.transactions;
  if (
    !user ||
    user.balance < query.balance.$gte ||
    user.transactions.some(
      (entry) => entry.transactionId === query['transactions.transactionId'].$ne
    )
  )
    return null;
  user.balance += update.$inc.balance;
  user.transactions.push(transaction);
  return structuredClone(user);
});
jest.mock('../bot/models/FlamingoPost.js', () => ({
  __esModule: true,
  default: {
    findById: (id) => ({
      lean: async () => (mockPost?._id === id ? mockPost : null)
    }),
    findOne: () => ({ lean: async () => mockPost })
  }
}));
jest.mock('../bot/models/User.js', () => ({
  __esModule: true,
  default: {
    findOne: async (query) =>
      structuredClone(mockUsers[query._id || query.accountId] || null),
    findOneAndUpdate: (...args) => mockCharge(...args)
  }
}));
jest.mock('../bot/middleware/auth.js', () => ({
  optionalAuthenticate: (req, _res, next) => {
    if (req.get('x-test-account'))
      req.auth = { accountId: req.get('x-test-account') };
    next();
  }
}));

describe('video resolution playback and download routes', () => {
  let directory, base, server, renditions, variant;
  const previous = {};
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'wall-video-routes-'));
    for (const [key, value] of Object.entries({
      FLAMINGO_UPLOAD_DIR: directory,
      FLAMINGO_GRIDFS_BACKUP: 'false'
    })) {
      previous[key] = process.env[key];
      process.env[key] = value;
    }
    const source = path.join(directory, 'source.mp4');
    await promisify(execFile)('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=360x640:rate=15',
      '-t',
      '2',
      '-c:v',
      'libx264',
      '-threads',
      '1',
      '-pix_fmt',
      'yuv420p',
      source
    ]);
    mockPost = {
      _id: '000000000000000000000010',
      attachment: {
        url: '/api/flamingo-wall/files/source.mp4',
        name: 'source.mp4',
        size: (await stat(source)).size,
        type: 'video/mp4',
        duration: 2,
        premium: true,
        priceTpg: 25
      }
    };
    const module = await import('../bot/routes/flamingoWall.js');
    renditions = module.videoRenditions;
    const app = express();
    app.use('/api/flamingo-wall', module.default);
    server = await new Promise((resolve) => {
      const active = app.listen(0, '127.0.0.1', () => resolve(active));
    });
    base = `http://127.0.0.1:${server.address().port}`;
    await fetch(
      `${base}/api/flamingo-wall/posts/${mockPost._id}/video-qualities`
    );
    await renditions.idle();
    const prepared = await fetch(
      `${base}/api/flamingo-wall/posts/${mockPost._id}/video-qualities`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality: '240p' })
      }
    );
    expect(prepared.status).toBe(202);
    await renditions.idle();
    variant = await renditions.file(mockPost, '240p');
    expect(variant).not.toBeNull();
  }, 15000);
  beforeEach(() => {
    mockCharge.mockClear();
    mockUsers = Object.fromEntries(
      ['viewer', 'viewer-two'].map((id) => [
        id,
        { _id: id, balance: 1000, transactions: [] }
      ])
    );
  });
  afterAll(async () => {
    if (renditions) await renditions.idle();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (directory) await rm(directory, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const download = (quality, authenticated = false, requestId) =>
    fetch(`${base}/api/flamingo-wall/posts/${mockPost._id}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authenticated
          ? {
              'x-test-account':
                authenticated === true ? 'viewer' : authenticated
            }
          : {})
      },
      body: JSON.stringify({
        quality,
        ...(requestId !== undefined ? { requestId } : {})
      })
    });

  test('lists real output dimensions and serves the chosen seekable MP4', async () => {
    const manifest = await (
      await fetch(
        `${base}/api/flamingo-wall/posts/${mockPost._id}/video-qualities`
      )
    ).json();
    const choice = manifest.qualities.find((item) => item.quality === '240p');
    expect(choice).toMatchObject({
      width: 240,
      height: 426,
      status: 'ready',
      size: variant.size
    });
    const response = await fetch(`${base}${choice.url}`, {
      headers: { Range: 'bytes=0-31' }
    });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-type')).toContain('video/mp4');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      (await readFile(variant.diskPath)).subarray(0, 32)
    );
    expect((await fetch(`${base}${choice.url}&download=1`)).status).toBe(403);
  });
  test('does not charge for missing, pending or unsupported resolutions', async () => {
    expect((await download('720p', true)).status).toBe(409);
    expect((await download('360p', true)).status).toBe(409);
    expect((await download('../../source', true)).status).toBe(409);
    expect(mockCharge).not.toHaveBeenCalled();
  });
  test('requires the normal payment identity and grants exactly the selected resolution', async () => {
    expect((await download('240p')).status).toBe(401);
    expect(mockCharge).not.toHaveBeenCalled();
    const response = await download('240p', true);
    expect(response.status).toBe(200);
    const grant = await response.json();
    expect(grant).toMatchObject({
      quality: '240p',
      name: 'source-240p.mp4',
      price: 25,
      balance: 975
    });
    expect(mockCharge).toHaveBeenCalledTimes(1);
    expect(mockCharge.mock.calls[0][1].$inc.balance).toBe(-25);
    const media = await fetch(`${base}${grant.downloadUrl}`, {
      headers: { Range: 'bytes=0-15' }
    });
    expect(media.status).toBe(206);
    expect(media.headers.get('content-disposition')).toContain(
      'source-240p.mp4'
    );
    expect(Buffer.from(await media.arrayBuffer())).toEqual(
      (await readFile(variant.diskPath)).subarray(0, 16)
    );
    const badUrl = grant.downloadUrl.replace('/downloads/', '/downloads/x');
    expect((await fetch(`${base}${badUrl}`)).status).toBe(403);
  });
  test('keeps original downloads and their price intact', async () => {
    const response = await download('original', true);
    const grant = await response.json();
    expect(grant).toMatchObject({
      quality: 'original',
      name: 'source.mp4',
      price: 25
    });
    expect(mockCharge).toHaveBeenCalledTimes(1);
    const media = await fetch(`${base}${grant.downloadUrl}`);
    expect(Buffer.from(await media.arrayBuffer())).toEqual(
      await readFile(path.join(directory, 'source.mp4'))
    );
  });

  test('renews grants for the same request without charging twice, including concurrent retries', async () => {
    const requestId = '12345678-1234-4321-abcd-123456789012';
    const responses = await Promise.all([
      download('240p', true, requestId),
      download('240p', true, requestId)
    ]);
    for (const response of responses) {
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        quality: '240p',
        price: 25,
        balance: 975
      });
    }
    const renewed = await download('240p', true, requestId);
    expect(renewed.status).toBe(200);
    expect(await renewed.json()).toMatchObject({ price: 25, balance: 975 });
    expect(mockUsers.viewer.balance).toBe(975);
    expect(mockUsers.viewer.transactions).toHaveLength(1);
    expect(mockUsers.viewer.transactions[0]).toMatchObject({
      type: 'video_download',
      amount: -25,
      detail: mockPost._id
    });
  });

  test('scopes download retry IDs to the viewer and selected resolution', async () => {
    const requestId = '12345678-1234-4321-abcd-123456789012';
    expect((await download('240p', true, requestId)).status).toBe(200);
    expect((await download('original', true, requestId)).status).toBe(200);
    expect((await download('240p', 'viewer-two', requestId)).status).toBe(200);
    expect(mockUsers.viewer.balance).toBe(950);
    expect(mockUsers['viewer-two'].balance).toBe(975);
    const ids = [
      ...mockUsers.viewer.transactions,
      ...mockUsers['viewer-two'].transactions
    ].map((entry) => entry.transactionId);
    expect(new Set(ids).size).toBe(3);
  });

  test('rejects malformed requests and keeps insufficient-balance checks intact', async () => {
    expect((await download('240p', true, 'not-a-request-id')).status).toBe(400);
    expect(mockCharge).not.toHaveBeenCalled();
    mockUsers.viewer.balance = 20;
    const response = await download(
      '240p',
      true,
      '12345678-1234-4321-abcd-123456789012'
    );
    expect(response.status).toBe(402);
    expect(mockUsers.viewer.balance).toBe(20);
    expect(mockUsers.viewer.transactions).toHaveLength(0);
  });
});
