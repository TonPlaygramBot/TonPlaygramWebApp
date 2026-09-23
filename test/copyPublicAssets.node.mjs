import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { copyPublicAssets } from '../webapp/scripts/copy-public-assets.mjs';

test('repeated public asset copies replace stale output and preserve emitted entries and source bytes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'public-assets-'));
  const source = path.join(root, 'public');
  const output = path.join(root, 'dist');
  const relative = 'assets/external/provider/image.png';
  try {
    await mkdir(path.dirname(path.join(source, relative)), { recursive: true });
    await mkdir(path.dirname(path.join(output, relative)), { recursive: true });
    await writeFile(path.join(source, relative), 'first verified image');
    await writeFile(path.join(output, relative), 'stale build copy');
    await writeFile(path.join(source, 'index.html'), 'public template');
    await writeFile(path.join(output, 'index.html'), 'bundled application');
    await copyPublicAssets(source, output, ['index.html']);
    await copyPublicAssets(source, output, ['index.html']);
    assert.equal(await readFile(path.join(output, relative), 'utf8'), 'first verified image');
    assert.equal(await readFile(path.join(source, relative), 'utf8'), 'first verified image');
    await writeFile(path.join(source, 'replacement.tmp'), 'new verified image');
    await rename(path.join(source, 'replacement.tmp'), path.join(source, relative));
    await copyPublicAssets(source, output, ['index.html']);
    assert.equal(await readFile(path.join(output, relative), 'utf8'), 'new verified image');
    assert.equal(await readFile(path.join(source, relative), 'utf8'), 'new verified image');
    assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'bundled application');
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('retired wall video originals remain on disk but are excluded from published assets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'retired-wall-assets-'));
  const source = path.join(root, 'public');
  const output = path.join(root, 'dist');
  try {
    await mkdir(path.join(source, 'ProtestVideo'), { recursive: true });
    await writeFile(path.join(source, 'ProtestVideo', 'old.mp4'), 'saved original');
    await writeFile(path.join(source, 'index.html'), 'main app');
    await copyPublicAssets(source, output);
    assert.equal(await readFile(path.join(source, 'ProtestVideo', 'old.mp4'), 'utf8'), 'saved original');
    assert.equal(await readFile(path.join(output, 'index.html'), 'utf8'), 'main app');
    await assert.rejects(readFile(path.join(output, 'ProtestVideo', 'old.mp4')), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
