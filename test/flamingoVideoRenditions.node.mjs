import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  createVideoRenditions,
  probeVideo,
  renditionDimensions,
  videoSourceKey
} from '../bot/services/flamingoVideoRenditions.js';

const execute = promisify(execFile);
test('real portrait renditions preserve orientation, audio and original bytes, persist across restart and reject upscaling', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'wall-quality-'));
  try {
    const source = path.join(directory, 'portrait.mp4');
    await execute('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=size=360x640:rate=15',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440',
      '-t',
      '2',
      '-c:v',
      'libx264',
      '-threads',
      '1',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      source
    ]);
    const sourceBytes = await readFile(source);
    const hash = createHash('sha256').update(sourceBytes).digest('hex');
    let post = {
      _id: '000000000000000000000001',
      attachment: {
        url: '/files/portrait.mp4',
        name: 'portrait.mp4',
        size: sourceBytes.length,
        type: 'video/mp4'
      }
    };
    let encodes = 0;
    const options = {
      directory,
      getPost: async () => post,
      getSource: async () => ({ diskPath: source }),
      inspectSpace: async () => ({ availableBytes: 10 * 1024 ** 3 })
    };
    const service = createVideoRenditions({
      ...options,
      encode: async (binary, args, signal, timeout) => {
        encodes++;
        return execute(binary, args, { signal, timeout });
      }
    });
    const first = await service.status(post);
    assert.equal(first.qualities[0].quality, 'original');
    assert.equal(first.processing, true);
    await service.idle();
    const manifest = await service.status(post);
    assert.deepEqual(
      manifest.qualities.map((item) => item.quality),
      ['original', '360p', '240p', '144p']
    );
    assert.equal(manifest.qualities[0].width, 360);
    assert.equal(manifest.qualities[0].height, 640);
    await assert.rejects(service.request(post, '720p'), { status: 400 });
    await Promise.all([
      service.request(post, '240p'),
      service.request(post, '240p')
    ]);
    await service.idle();
    assert.equal(encodes, 1);
    const ready = (await service.status(post)).qualities.find(
      (item) => item.quality === '240p'
    );
    assert.equal(ready.status, 'ready');
    assert.ok(ready.size > 1000);
    assert.match(ready.url, /\/video\/240p\?v=/);
    const stored = await service.file(post, '240p');
    const converted = await probeVideo(stored.diskPath);
    assert.deepEqual(
      { width: converted.width, height: converted.height },
      { width: 240, height: 426 }
    );
    assert.ok(Math.abs(converted.duration - 2) < 0.2);
    const audio = JSON.parse(
      (
        await execute('ffprobe', [
          '-v',
          'error',
          '-select_streams',
          'a:0',
          '-show_entries',
          'stream=codec_name',
          '-of',
          'json',
          stored.diskPath
        ])
      ).stdout
    );
    assert.equal(audio.streams[0].codec_name, 'aac');
    assert.equal(
      createHash('sha256')
        .update(await readFile(source))
        .digest('hex'),
      hash
    );
    const restarted = createVideoRenditions(options);
    const rotatedPath = path.join(directory, 'rotated.mp4');
    await execute('ffmpeg', [
      '-v',
      'error',
      '-display_rotation',
      '90',
      '-i',
      source,
      '-c',
      'copy',
      rotatedPath
    ]);
    const rotatedInfo = await probeVideo(rotatedPath);
    assert.deepEqual(
      { width: rotatedInfo.width, height: rotatedInfo.height },
      { width: 640, height: 360 }
    );
    const rotatedPost = {
      ...post,
      _id: '000000000000000000000003',
      attachment: { ...post.attachment, url: '/files/rotated.mp4' }
    };
    const rotatedService = createVideoRenditions({
      ...options,
      getPost: async () => rotatedPost,
      getSource: async () => ({ diskPath: rotatedPath })
    });
    await rotatedService.status(rotatedPost);
    await rotatedService.idle();
    await rotatedService.request(rotatedPost, '240p');
    await rotatedService.idle();
    const rotatedResult = await probeVideo(
      (await rotatedService.file(rotatedPost, '240p')).diskPath
    );
    assert.deepEqual(
      { width: rotatedResult.width, height: rotatedResult.height },
      { width: 426, height: 240 }
    );
    assert.equal(
      (await restarted.status(post)).qualities.find(
        (item) => item.quality === '240p'
      ).status,
      'ready'
    );
    assert.equal(await restarted.file(post, '../../portrait'), null);
    // A request marker left by a restart resumes on the next menu visit.
    await writeFile(
      path.join(
        directory,
        '.qualities',
        `${post._id}-${videoSourceKey(post)}`,
        '144p.request.json'
      ),
      JSON.stringify({ at: Date.now() })
    );
    const recovering = createVideoRenditions(options);
    assert.equal((await recovering.status(post)).processing, true);
    await recovering.idle();
    assert.equal((await recovering.file(post, '144p')).quality, '144p');
    const oldKey = videoSourceKey(post);
    post = {
      ...post,
      attachment: { ...post.attachment, url: '/files/replacement.mp4' }
    };
    assert.notEqual(videoSourceKey(post), oldKey);
    assert.equal(await restarted.file(post, '240p'), null);
    await restarted.sweep();
    assert.deepEqual(await readdir(path.join(directory, '.qualities')), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('does not upscale portrait, landscape or square sources', () => {
  assert.deepEqual(renditionDimensions({ width: 1920, height: 1080 }, 720), {
    width: 1280,
    height: 720
  });
  assert.deepEqual(renditionDimensions({ width: 1080, height: 1920 }, 720), {
    width: 720,
    height: 1280
  });
  assert.deepEqual(renditionDimensions({ width: 1080, height: 1080 }, 480), {
    width: 480,
    height: 480
  });
  assert.throws(() => renditionDimensions({ width: 640, height: 360 }, 720), {
    status: 400
  });
});

test('full storage leaves the original available and does not launch an encoder', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'wall-quality-full-'));
  try {
    const post = {
      _id: '000000000000000000000002',
      attachment: {
        url: '/files/original.mp4',
        name: 'original.mp4',
        size: 100,
        type: 'video/mp4'
      }
    };
    let encodes = 0;
    const service = createVideoRenditions({
      directory,
      getPost: async () => post,
      getSource: async () => ({ diskPath: 'unused' }),
      probe: async () => ({ width: 1920, height: 1080, duration: 60 }),
      inspectSpace: async () => ({ availableBytes: 256 * 1024 ** 2 }),
      encode: async () => {
        encodes++;
      }
    });
    await service.status(post);
    await service.idle();
    await service.request(post, '360p');
    await service.idle();
    const result = await service.status(post);
    assert.equal(encodes, 0);
    assert.equal(result.qualities[0].status, 'ready');
    assert.match(
      result.qualities.find((item) => item.quality === '360p').error,
      /not enough space/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
