import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  utimes,
  writeFile
} from 'node:fs/promises';

export const videoQualities = [144, 240, 360, 480, 720, 1080, 1440, 2160];
const bitrate = {
  144: 200,
  240: 400,
  360: 800,
  480: 1400,
  720: 2800,
  1080: 5000,
  1440: 8000,
  2160: 14000
};
const fail = (message, status = 503) =>
  Object.assign(new Error(message), { status });
const exists = async (file) => {
  try {
    const info = await lstat(file);
    return info.isFile() ? info : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};
const readJson = async (file) => {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
};
const writeJson = async (file, value) => {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value));
  await rename(temporary, file);
};
export const videoSourceKey = (post) =>
  createHash('sha256')
    .update(
      JSON.stringify([
        String(post._id),
        post.attachment.url,
        post.attachment.objectKey,
        post.attachment.objectBucket,
        post.attachment.databaseFileId,
        post.attachment.size
      ])
    )
    .digest('hex')
    .slice(0, 24);

function run(binary, args, signal, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    execFile(
      binary,
      args,
      { signal, timeout, killSignal: 'SIGKILL', maxBuffer: 256 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      }
    );
  });
}
export async function probeVideo(file, signal) {
  const result = JSON.parse(
    await run(
      process.env.FFPROBE_PATH || 'ffprobe',
      [
        '-v',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-format_whitelist',
        'mov,matroska,webm,avi,mpeg,mpegts,ogg',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height,sample_aspect_ratio:stream_tags=rotate:stream_side_data=rotation:format=duration',
        '-of',
        'json',
        file
      ],
      signal
    )
  );
  const stream = result.streams?.[0];
  const [sarWidth, sarHeight] = String(stream?.sample_aspect_ratio || '1:1')
    .split(':')
    .map(Number);
  let width = Math.round(
    Number(stream?.width) *
      (sarWidth > 0 && sarHeight > 0 ? sarWidth / sarHeight : 1)
  );
  let height = Number(stream?.height);
  const rotation = Number(
    stream?.side_data_list?.find((item) => item.rotation != null)?.rotation ??
      stream?.tags?.rotate ??
      0
  );
  if (Math.abs(Math.round(rotation / 90)) % 2)
    [width, height] = [height, width];
  const duration = Number(result.format?.duration);
  if (
    ![width, height, duration].every(
      (value) => Number.isFinite(value) && value > 0
    ) ||
    width > 16384 ||
    height > 16384 ||
    width * height > 40_000_000
  )
    throw fail(
      'This video cannot be converted. The original remains available.',
      422
    );
  return { width, height, duration };
}
export function renditionDimensions(source, quality) {
  if (
    !videoQualities.includes(quality) ||
    quality > Math.min(source.width, source.height)
  )
    throw fail('This resolution is higher than the original video.', 400);
  const scale = quality / Math.min(source.width, source.height);
  return {
    width: Math.max(2, Math.round((source.width * scale) / 2) * 2),
    height: Math.max(2, Math.round((source.height * scale) / 2) * 2)
  };
}

// A single bounded queue uses the existing service/disk. Only requested
// resolutions are encoded; originals and upload sessions are never overwritten.
export function createVideoRenditions({
  directory,
  getSource,
  getPost,
  inspectSpace,
  probe = probeVideo,
  encode = run,
  cacheBytes = 10 * 1024 ** 3
}) {
  const root = path.join(directory, '.qualities');
  const jobs = new Map();
  const errors = new Map();
  const protectedUntil = new Map();
  const queue = [];
  let running = false;
  const location = (post) =>
    path.join(root, `${post._id}-${videoSourceKey(post)}`);
  const jobKey = (post, quality) => `${videoSourceKey(post)}:${quality}`;
  const metadata = (post) =>
    readJson(path.join(location(post), 'metadata.json'));
  async function trimCache(required = 0) {
    const folders = [];
    for (const name of await readdir(root).catch(() => [])) {
      if (!/^[a-f\d]{24}-[a-f\d]{24}$/.test(name)) continue;
      const folder = path.join(root, name);
      const info = await lstat(folder);
      if (!info.isDirectory()) continue;
      let size = 0;
      for (const fileName of await readdir(folder)) {
        if (fileName.endsWith('.mp4'))
          size += (await exists(path.join(folder, fileName)))?.size || 0;
      }
      folders.push({
        folder,
        size,
        accessed: info.mtimeMs,
        active: [...jobs.values()].some((job) => location(job.post) === folder)
      });
    }
    let size = folders.reduce((total, item) => total + item.size, 0);
    for (const item of folders.sort((a, b) => a.accessed - b.accessed)) {
      if (size + required <= cacheBytes) break;
      // Recent playback/download grants and active encodes remain intact.
      if (item.active || Date.now() - item.accessed < 10 * 60_000) continue;
      if ((protectedUntil.get(item.folder) || 0) > Date.now()) continue;
      await rm(item.folder, { recursive: true, force: true });
      size -= item.size;
    }
    if (size + required > cacheBytes)
      throw fail(
        'Video processing space is busy. Try a smaller resolution or try again later.',
        503
      );
    return cacheBytes - size;
  }
  const current = async (post) => {
    const latest = await getPost(String(post._id));
    if (!latest?.attachment || videoSourceKey(latest) !== videoSourceKey(post))
      throw fail('This video has been removed or replaced.', 410);
  };
  async function file(post, quality) {
    if (
      typeof quality !== 'string' ||
      !/^\d+p$/.test(quality) ||
      !videoQualities.includes(Number(quality.slice(0, -1)))
    )
      return null;
    protectedUntil.set(location(post), Date.now() + 10 * 60_000);
    for (const [folder, until] of protectedUntil)
      if (until < Date.now()) protectedUntil.delete(folder);
    const details = await readJson(
      path.join(location(post), `${quality}.json`)
    );
    const diskPath = path.join(location(post), `${quality}.mp4`);
    const info = details && (await exists(diskPath));
    if (!info || !details || info.size !== details.size) return null;
    const now = new Date();
    await utimes(location(post), now, now);
    return { ...details, diskPath };
  }
  async function perform(job) {
    const { post, quality, controller } = job;
    const signal = controller.signal;
    const folder = location(post);
    await current(post);
    await mkdir(folder, { recursive: true });
    let source;
    const output = path.join(folder, `${quality}.partial.mp4`);
    let monitor;
    const deadline = setTimeout(() => controller.abort(), 65 * 60_000);
    deadline.unref?.();
    try {
      source = await getSource(post, folder, signal);
      const info =
        (await metadata(post)) || (await probe(source.diskPath, signal));
      await current(post);
      await writeJson(path.join(folder, 'metadata.json'), info);
      if (quality === 'probe' || (await file(post, quality))) return;
      const target = Number(quality.slice(0, -1));
      const dimensions = renditionDimensions(info, target);
      // Reserve breathing room for incoming uploads. FFmpeg has an additional
      // hard output limit; a duration check rejects truncated output on exit.
      const estimate =
        Math.ceil(
          ((info.duration * (bitrate[target] + 128) * 1000) / 8) * 1.25
        ) +
        8 * 1024 ** 2;
      const cacheAvailable = await trimCache(estimate);
      const space = await inspectSpace();
      const budget = Math.min(
        2 * 1024 ** 3,
        cacheAvailable,
        space.availableBytes - 512 * 1024 ** 2
      );
      if (estimate > budget)
        throw fail(
          'There is not enough space for this resolution. Choose the original or a smaller resolution.',
          507
        );
      let checking = false;
      monitor = setInterval(async () => {
        if (checking) return;
        checking = true;
        try {
          if ((await inspectSpace()).availableBytes < 256 * 1024 ** 2)
            controller.abort();
        } catch {
          controller.abort();
        } finally {
          checking = false;
        }
      }, 2000);
      monitor.unref?.();
      await encode(
        process.env.FFMPEG_PATH || 'ffmpeg',
        [
          '-nostdin',
          '-v',
          'error',
          '-y',
          '-threads',
          '1',
          '-protocol_whitelist',
          'file,pipe',
          '-format_whitelist',
          'mov,matroska,webm,avi,mpeg,mpegts,ogg',
          '-i',
          source.diskPath,
          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',
          '-map_metadata',
          '-1',
          '-vf',
          `scale=${dimensions.width}:${dimensions.height},setsar=1`,
          '-filter_threads',
          '1',
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-crf',
          '23',
          '-threads',
          '1',
          '-pix_fmt',
          'yuv420p',
          '-maxrate',
          `${bitrate[target]}k`,
          '-bufsize',
          `${bitrate[target] * 2}k`,
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-ac',
          '2',
          '-movflags',
          '+faststart',
          '-fs',
          String(Math.floor(budget)),
          output
        ],
        signal,
        60 * 60_000
      );
      const converted = await probe(output, signal);
      if (
        converted.width !== dimensions.width ||
        converted.height !== dimensions.height ||
        Math.abs(converted.duration - info.duration) >
          Math.max(0.15, Math.min(1, info.duration * 0.002))
      )
        throw fail(
          'The video could not be fully converted. Please try another resolution.',
          422
        );
      await current(post);
      const details = {
        ...dimensions,
        quality,
        size: (await lstat(output)).size,
        type: 'video/mp4',
        name: `${path.parse(post.attachment.name).name}-${quality}.mp4`
      };
      await rename(output, path.join(folder, `${quality}.mp4`));
      await writeJson(path.join(folder, `${quality}.json`), details);
    } finally {
      clearTimeout(deadline);
      clearInterval(monitor);
      await rm(output, { force: true });
      await rm(path.join(folder, `${quality}.request.json`), { force: true });
      await source?.cleanup?.();
    }
  }
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        const job = queue.shift();
        job.state = 'processing';
        try {
          await perform(job);
        } catch (error) {
          const message = error.status
            ? error.message
            : 'This resolution could not be prepared. The original is still available.';
          errors.set(job.key, { message, at: Date.now() });
          if (errors.size > 256) errors.delete(errors.keys().next().value);
          console.warn(
            'Wall video conversion:',
            error.code || error.message?.slice(0, 180)
          );
        } finally {
          jobs.delete(job.key);
          job.done();
        }
      }
    } finally {
      running = false;
    }
  }
  function enqueue(post, quality) {
    const key = jobKey(post, quality);
    if (jobs.has(key)) return;
    if (jobs.size >= 20)
      throw fail('Video processing is busy. Please try again shortly.', 429);
    const failure = errors.get(key);
    if (failure && Date.now() - failure.at < 5000)
      throw fail(failure.message, 503);
    errors.delete(key);
    let done;
    const finished = new Promise((resolve) => {
      done = resolve;
    });
    const job = {
      post,
      quality,
      key,
      state: 'queued',
      controller: new AbortController(),
      finished,
      done
    };
    jobs.set(key, job);
    queue.push(job);
    void drain();
  }
  async function status(post) {
    const info = await metadata(post);
    const original = {
      quality: 'original',
      label: info
        ? `Original (${Math.min(info.width, info.height)}p)`
        : 'Original',
      status: 'ready',
      size: post.attachment.size,
      type: post.attachment.type,
      name: post.attachment.name,
      url: post.attachment.url,
      ...(info || {})
    };
    const probeKey = jobKey(post, 'probe');
    if (!info) {
      if (!jobs.has(probeKey) && !errors.has(probeKey)) enqueue(post, 'probe');
      return {
        qualities: [original],
        processing: jobs.has(probeKey),
        error: errors.get(probeKey)?.message
      };
    }
    const qualities = [original];
    for (const target of videoQualities
      .filter((value) => value <= Math.min(info.width, info.height))
      .reverse()) {
      const quality = `${target}p`;
      const ready = await file(post, quality);
      const key = jobKey(post, quality);
      if (!ready && !jobs.has(key) && !errors.has(key)) {
        const requested = await readJson(
          path.join(location(post), `${quality}.request.json`)
        );
        if (requested && Date.now() - requested.at < 48 * 60 * 60_000)
          enqueue(post, quality);
      }
      qualities.push({
        quality,
        label: quality,
        ...renditionDimensions(info, target),
        ...(ready
          ? {
              size: ready.size,
              type: ready.type,
              name: ready.name,
              url: `/api/flamingo-wall/posts/${post._id}/video/${quality}?v=${videoSourceKey(post)}`
            }
          : {}),
        status: ready
          ? 'ready'
          : jobs.get(key)?.state || (errors.has(key) ? 'failed' : 'available'),
        error: errors.get(key)?.message
      });
    }
    return {
      qualities,
      processing: qualities.some((item) =>
        ['queued', 'processing'].includes(item.status)
      )
    };
  }
  async function request(post, quality) {
    if (quality === 'probe') {
      enqueue(post, quality);
      return status(post);
    }
    if (typeof quality !== 'string' || !/^\d+p$/.test(quality))
      throw fail('Invalid video resolution.', 400);
    const info = await metadata(post);
    if (!info)
      throw fail(
        'Video details are still loading. Please try again shortly.',
        409
      );
    renditionDimensions(info, Number(quality.slice(0, -1)));
    if (!(await file(post, quality)) && !jobs.has(jobKey(post, quality))) {
      const marker = path.join(location(post), `${quality}.request.json`);
      await writeJson(marker, { at: Date.now() });
      try {
        enqueue(post, quality);
      } catch (error) {
        await rm(marker, { force: true });
        throw error;
      }
    }
    return status(post);
  }
  async function remove(postId) {
    const matching = [...jobs.values()].filter(
      (job) => String(job.post._id) === String(postId)
    );
    matching.forEach((job) => {
      job.controller.abort();
      if (job.state === 'queued') {
        const index = queue.indexOf(job);
        if (index >= 0) queue.splice(index, 1);
        jobs.delete(job.key);
        job.done();
      }
    });
    await Promise.all(matching.map((job) => job.finished));
    for (const name of await readdir(root).catch(() => []))
      if (name.startsWith(`${postId}-`))
        await rm(path.join(root, name), { recursive: true, force: true });
  }
  async function sweep() {
    for (const name of await readdir(root).catch(() => [])) {
      const match = /^([a-f\d]{24})-([a-f\d]{24})$/.exec(name);
      if (
        !match ||
        [...jobs.values()].some((job) => videoSourceKey(job.post) === match[2])
      )
        continue;
      const post = await getPost(match[1]);
      if (!post?.attachment || videoSourceKey(post) !== match[2])
        await rm(path.join(root, name), { recursive: true, force: true });
      else
        for (const fileName of await readdir(path.join(root, name))) {
          if (fileName.endsWith('.tmp') || fileName.includes('.partial'))
            await rm(path.join(root, name, fileName), { force: true });
        }
    }
    await trimCache();
  }
  return {
    status,
    request,
    file,
    remove,
    sweep,
    idle: async () => {
      while (jobs.size)
        await Promise.all([...jobs.values()].map((job) => job.finished));
    }
  };
}
