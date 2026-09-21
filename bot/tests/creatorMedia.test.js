import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encoderArgs } from '../creator/live.js';
const exec = promisify(execFile);
test('browser-style WebM with audio becomes portrait H.264/AAC FLV', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'creator-encoder-'));
  try {
    const input = path.join(dir, 'camera.webm'), output = path.join(dir, 'broadcast.flv');
    await exec('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=navy:s=360x640:r=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1','-c:v','libvpx','-threads','1','-c:a','libopus',input], { timeout: 30000 });
    const child = spawn('ffmpeg', encoderArgs(output, true, '720'), { stdio: ['pipe','ignore','pipe'] });
    let errors = ''; child.stderr.on('data', bytes => { errors += bytes; }); child.stdin.end(await readFile(input));
    const exit = await new Promise(resolve => { child.on('error', resolve); child.on('exit', resolve); }); assert.equal(exit, 0, errors);
    const info = JSON.parse((await exec('ffprobe', ['-v','error','-show_streams','-of','json',output])).stdout);
    const video = info.streams.find(s => s.codec_type === 'video'), audio = info.streams.find(s => s.codec_type === 'audio');
    assert.equal(video.codec_name, 'h264'); assert.equal(video.width, 720); assert.equal(video.height, 1280); assert.equal(audio.codec_name, 'aac');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
