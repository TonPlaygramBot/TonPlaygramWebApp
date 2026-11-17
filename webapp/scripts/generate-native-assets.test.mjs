import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, copyFile, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import sharp from 'sharp';

const exec = promisify(execFile);
const webapp = fileURLToPath(new URL('..', import.meta.url));

test('native assets have unique catalog slots, opaque icons and repeatable manifests', { timeout: 120000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'tpg-native-assets-'));
  try {
    await mkdir(join(root, 'scripts'), { recursive: true });
    await mkdir(join(root, 'public/assets/icons'), { recursive: true });
    await copyFile(join(webapp, 'scripts/generate-native-assets.mjs'), join(root, 'scripts/generate-native-assets.mjs'));
    await symlink(join(webapp, 'node_modules'), join(root, 'node_modules'), 'dir');
    // Transparent input exercises alpha removal rather than merely using an opaque fixture.
    const fixture = await sharp({ create: { width: 32, height: 48, channels: 4, background: '#ff000080' } }).png().toBuffer();
    await sharp(fixture).webp().toFile(join(root, 'public/assets/icons/TON.webp'));
    await sharp(fixture).toFile(join(root, 'public/assets/icons/file_00000000efd081f78539cff614489f91.png'));
    const generate = () => exec(process.execPath, [join(root, 'scripts/generate-native-assets.mjs')]);
    await generate();
    const iconDir = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
    const splashDir = join(root, 'ios/App/App/Assets.xcassets/Splash.imageset');
    const iconManifest = await readFile(join(iconDir, 'Contents.json'), 'utf8');
    const splashManifest = await readFile(join(splashDir, 'Contents.json'), 'utf8');
    const icons = JSON.parse(iconManifest).images;
    const splashes = JSON.parse(splashManifest).images;
    assert.equal(icons.length, 18);
    assert.equal(new Set(icons.map(i => `${i.idiom}/${i.size}/${i.scale}`)).size, icons.length);
    assert.equal(new Set(icons.map(i => i.filename)).size, icons.length);
    for (const icon of icons) {
      const metadata = await sharp(join(iconDir, icon.filename)).metadata();
      const size = Math.round(parseFloat(icon.size) * parseInt(icon.scale));
      assert.equal(metadata.width, size);
      assert.equal(metadata.height, size);
      assert.equal(metadata.hasAlpha, false, icon.filename);
    }
    assert.deepEqual(splashes.map(i => `${i.idiom}/${i.scale}`), ['universal/1x', 'universal/2x', 'universal/3x']);
    for (const splash of splashes) {
      const metadata = await sharp(join(splashDir, splash.filename)).metadata();
      assert.equal(metadata.width, 428 * parseInt(splash.scale));
      assert.equal(metadata.height, 926 * parseInt(splash.scale));
    }
    // Other platforms retain the existing output sizes.
    for (const [density, size] of Object.entries({ mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 })) {
      for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground']) {
        const metadata = await sharp(join(root, `android/app/src/main/res/mipmap-${density}/${name}.png`)).metadata();
        assert.equal(metadata.width, size);
        assert.equal(metadata.height, size);
      }
    }
    const pwa = await sharp(join(root, 'public/assets/splash/splash-1284x2778.png')).metadata();
    assert.equal(pwa.width, 1284);
    assert.equal(pwa.height, 2778);
    await generate();
    assert.equal(await readFile(join(iconDir, 'Contents.json'), 'utf8'), iconManifest);
    assert.equal(await readFile(join(splashDir, 'Contents.json'), 'utf8'), splashManifest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
