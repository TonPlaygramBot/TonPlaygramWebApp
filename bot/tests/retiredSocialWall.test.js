import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import { retiredSocialWall } from '../middleware/retiredSocialWall.js';

let server, origin, directory;
let downstream = 0;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'retired-wall-'));
  await mkdir(path.join(directory, 'ProtestVideo'));
  await writeFile(path.join(directory, 'ProtestVideo', 'saved.mp4'), 'private original video');
  const app = express();
  app.use(retiredSocialWall);
  app.use(express.static(directory));
  app.use(express.json());
  app.use((_req, res) => { downstream++; res.json({ available: true }); });
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
});

test('old feeds, byte-range streams, downloads, uploads and legacy wall routes return 410', async () => {
  const beforeCount = downstream;
  for (const [method, url] of [
    ['GET', '/api/flamingo-wall/latest-post'],
    ['GET', '/api/flamingo-wall/files/saved.mp4?download=1'],
    ['GET', '/api/flamingo-wall/downloads/old-grant'],
    ['HEAD', '/api/flamingo-wall/files/saved.mp4'],
    ['GET', '/api/flamingo-wall/events'],
    ['GET', '/api/flamingo-wall/social/profile/123'],
    ['POST', '/api/flamingo-wall/notifications/subscribe'],
    ['POST', '/api/flamingo-wall/uploads'],
    ['PUT', '/api/flamingo-wall/uploads/saved/chunks/0'],
    ['PATCH', '/api/flamingo-wall/posts/123'],
    ['DELETE', '/api/flamingo-wall/posts/123'],
    ['POST', '/api/social/wall/post'],
    ['GET', '/api/protest-videos/download/saved.mp4'],
    ['GET', '/ProtestVideo/saved.mp4'],
    ['GET', '/%50rotestVideo/saved.mp4'],
    ['GET', '/api/FLAMINGO-wall']
  ]) {
    const response = await fetch(origin + url, {
      method,
      headers: { Range: 'bytes=0-', 'Content-Type': 'application/json' },
      // Malformed JSON proves rejection precedes body parsing/upload work.
      ...(!['GET', 'HEAD'].includes(method) ? { body: '{' } : {})
    });
    assert.equal(response.status, 410, `${method} ${url}`);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.text();
    assert.ok(body.length < 150);
    assert.ok(!body.includes('private original video'));
  }
  assert.equal(downstream, beforeCount);
});

test('games, embedded chess, accounts and Social Hub requests remain available', async () => {
  for (const url of ['/api/health', '/games/chessbattleroyal', '/colyseus/matchmake', '/api/social/messages', '/api/social/friends', '/api/account', '/api/wallet', '/social-app/hub', '/api/flamingo-wallpaper']) {
    const response = await fetch(origin + url);
    assert.equal(response.status, 200, url);
    assert.deepEqual(await response.json(), { available: true });
  }
});
