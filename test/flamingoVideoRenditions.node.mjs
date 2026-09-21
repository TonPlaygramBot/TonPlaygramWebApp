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
  encodeVideo,
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
    const progress = [];
    const options = {
      directory,
      getPost: async () => post,
      getSource: async () => ({ diskPath: source }),
      inspectSpace: async () => ({ availableBytes: 10 * 1024 ** 3 })
    };
    const service = createVideoRenditions({
      ...options,
      encode: async (binary, args, signal, timeout, onProgress) => {
        encodes++;
        return encodeVideo(binary, args, signal, timeout, (value) => {
          progress.push(value);
          onProgress(value);
        });
      }
    });
    const first = await service.status(post);
    assert.equal(first.qualities[0].quality, 'original');
    assert.equal(first.processing, true);
    await service.idle();
    const manifest = await service.status(post);
    assert.deepEqual(
      manifest.qualities.map((item) => item.quality),
      ['original', '240p', '144p']
    );
    assert.equal(manifest.qualities[0].width, 360);
    assert.equal(manifest.qualities[0].height, 640);
    await assert.rejects(service.request(post, '720p'), { status: 400 });
    await assert.rejects(service.request(post, '360p'), /Choose Original/);
    await Promise.all([
      service.request(post, '240p'),
      service.request(post, '240p')
    ]);
    await service.idle();
    assert.equal(encodes, 1);
    assert.ok(
      progress.some((value) => value.seconds > 0),
      'Reports actual encoder progress'
    );
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
    assert.equal((await recovering.file(post, '144p')).sourceQuality, '240p');
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

test(
  'metadata bypasses a long encode and viewer requests preempt background preparation without concurrent encoders',
  { timeout: 15000 },
  async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), 'wall-quality-priority-')
    );
    const posts = [1, 2].map((value) => ({
      _id: String(value).padStart(24, '0'),
      attachment: {
        url: `/files/${value}.mp4`,
        name: `${value}.mp4`,
        size: 1_000_000,
        type: 'video/mp4'
      }
    }));
    const info = { width: 720, height: 1280, duration: 2 };
    let firstStarted;
    const started = new Promise((resolve) => {
      firstStarted = resolve;
    });
    let active = 0,
      maximum = 0,
      interrupted = false;
    const calls = [];
    const service = createVideoRenditions({
      directory,
      getPost: async (id) => posts.find((post) => post._id === id),
      getSource: async (post) => ({
        diskPath: path.join(directory, `${post._id}.mp4`)
      }),
      inspectSpace: async () => ({ availableBytes: 10 * 1024 ** 3 }),
      probe: async (file) => {
        const target = path.basename(file).match(/^(\d+)p\.partial\.mp4$/);
        return target
          ? { ...renditionDimensions(info, Number(target[1])), duration: 2 }
          : info;
      },
      encode: async (_binary, args, signal, _timeout, progress) => {
        const output = args.at(-1);
        const firstPost = output.includes(posts[0]._id);
        const label = `${firstPost ? 'background' : 'viewer'}:${path.basename(output)}`;
        calls.push(label);
        active++;
        maximum = Math.max(maximum, active);
        try {
          progress({ seconds: 1, speed: 2 });
          if (calls.length === 1) {
            firstStarted();
            await new Promise((resolve, reject) => {
              signal.addEventListener(
                'abort',
                () => {
                  interrupted = true;
                  reject(signal.reason);
                },
                { once: true }
              );
              if (signal.aborted) reject(signal.reason);
            });
          }
          await writeFile(output, Buffer.alloc(64));
        } finally {
          active--;
        }
      }
    });
    try {
      await service.warm(posts[0]);
      await started;
      const working = (await service.status(posts[0])).qualities.find(
        (item) => item.quality === '480p'
      );
      assert.equal(working.progress, 50);
      assert.equal(working.remainingSeconds, 1);
      // Reading another video's details must complete even though the first
      // encoder deliberately never finishes without a priority interrupt.
      await service.status(posts[1]);
      let details;
      for (let attempt = 0; attempt < 100; attempt++) {
        details = await service.status(posts[1]);
        if (details.qualities.length > 1) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(details.qualities.length > 1);
      assert.equal(interrupted, false);
      await service.request(posts[1], '240p');
      await service.idle();
      assert.equal(interrupted, true);
      assert.equal(maximum, 1);
      assert.match(calls[1], /^viewer:240p/);
      assert.match(calls[2], /^background:480p/);
      assert.equal((await service.file(posts[1], '240p')).quality, '240p');
      const warmed = (await service.status(posts[0])).qualities;
      assert.ok(warmed.every((item) => item.status === 'ready'));
      assert.equal(
        (await service.file(posts[0], '360p')).sourceQuality,
        '480p'
      );
    } finally {
      await Promise.all(posts.map((post) => service.remove(post._id)));
      await rm(directory, { recursive: true, force: true });
    }
  }
);

test(
  'prepares common copies ahead of selection and bounds high frame rate conversion to 30 fps',
  { timeout: 20000 },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'wall-quality-warm-'));
    try {
      const source = path.join(directory, 'high-frame-rate.mp4');
      await execute('ffmpeg', [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=480x854:rate=60',
        '-t',
        '1.2',
        '-c:v',
        'libx264',
        '-threads',
        '1',
        '-preset',
        'ultrafast',
        source
      ]);
      const post = {
        _id: '000000000000000000000004',
        attachment: {
          url: '/files/high-frame-rate.mp4',
          name: 'high-frame-rate.mp4',
          type: 'video/mp4',
          size: (await readFile(source)).length
        }
      };
      let encodes = 0,
        originalReads = 0;
      const service = createVideoRenditions({
        directory,
        getPost: async () => post,
        getSource: async () => {
          originalReads++;
          return { diskPath: source };
        },
        inspectSpace: async () => ({ availableBytes: 10 * 1024 ** 3 }),
        encode: (...args) => {
          encodes++;
          return encodeVideo(...args);
        }
      });
      await service.warm(post);
      await service.idle();
      assert.ok(
        (await service.status(post)).qualities.every(
          (item) => item.status === 'ready'
        )
      );
      assert.equal(encodes, 3);
      assert.equal(
        originalReads,
        2,
        'Only the probe and first encode read the original'
      );
      const copy = await service.file(post, '360p');
      const streams = JSON.parse(
        (
          await execute('ffprobe', [
            '-v',
            'error',
            '-show_entries',
            'stream=avg_frame_rate,width,height',
            '-of',
            'json',
            copy.diskPath
          ])
        ).stdout
      ).streams;
      assert.equal(streams[0].avg_frame_rate, '30/1');
      assert.equal(streams[0].width, 360);
      await service.request(post, '240p');
      await service.idle();
      assert.equal(
        encodes,
        3,
        'Choosing a prepared resolution launches no encoder'
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
);
