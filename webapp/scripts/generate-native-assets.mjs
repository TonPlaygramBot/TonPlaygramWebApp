import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const iconSource = join(rootDir, 'public/assets/icons/TON.webp');
const splashSource = join(rootDir, 'public/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp');

const generatedIconDir = join(rootDir, 'public/assets/icons/generated');
const iosAppIconDir = join(rootDir, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const iosSplashDir = join(rootDir, 'ios/App/App/Assets.xcassets/Splash.imageset');

const androidMipmapBase = join(rootDir, 'android/app/src/main/res');
const androidDrawableDir = join(androidMipmapBase, 'drawable');

const brandColor = { r: 0x0b, g: 0x12, b: 0x24, alpha: 1 };

async function ensureSourceExists(path, hint) {
  try {
    await access(path);
  } catch (err) {
    throw new Error(`${hint} missing at ${path}. Place the expected asset before running generation.`, { cause: err });
  }
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function buildBaseIcon(size) {
  const background = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: brandColor
    }
  }).png().toBuffer();

  const overlay = await sharp(iconSource)
    .resize(Math.floor(size * 0.56), Math.floor(size * 0.56), {
      fit: 'contain'
    })
    .png()
    .toBuffer();

  return sharp(background).composite([{ input: overlay, gravity: 'center' }]).png().toBuffer();
}

async function generateIosIcons() {
  const iosTargets = [
    { idiom: 'iphone', size: 20, scales: [2, 3] },
    { idiom: 'iphone', size: 29, scales: [2, 3] },
    { idiom: 'iphone', size: 40, scales: [2, 3] },
    { idiom: 'iphone', size: 60, scales: [2, 3] },
    { idiom: 'ipad', size: 20, scales: [1, 2] },
    { idiom: 'ipad', size: 29, scales: [1, 2] },
    { idiom: 'ipad', size: 40, scales: [1, 2] },
    { idiom: 'ipad', size: 76, scales: [1, 2] },
    { idiom: 'ipad', size: 83.5, scales: [2] },
    { idiom: 'ios-marketing', size: 1024, scales: [1] }
  ];

  const contents = { images: [], info: { version: 1, author: 'xcode' } };
  const baseBuffer = await buildBaseIcon(1024);

  await ensureDir(iosAppIconDir);

  await Promise.all(
    iosTargets.flatMap(({ idiom, size, scales }) =>
      scales.map(async (scale) => {
        const scaledSize = Math.round(size * scale);
        const filename = `app-icon-${size}x${size}@${scale}x.png`;
        const outputPath = join(iosAppIconDir, filename);
        const buffer = await sharp(baseBuffer).resize(scaledSize, scaledSize).png().toBuffer();
        await writeFile(outputPath, buffer);
        contents.images.push({
          filename,
          idiom,
          scale: `${scale}x`,
          size: `${size}x${size}`
        });
      })
    )
  );

  await writeFile(join(iosAppIconDir, 'Contents.json'), JSON.stringify(contents, null, 2));
}

async function generateIosSplash() {
  await ensureDir(iosSplashDir);
  const sizes = [
    { filename: 'splash-1242x2688.png', width: 1242, height: 2688, scale: '3x' },
    { filename: 'splash-1125x2436.png', width: 1125, height: 2436, scale: '3x' },
    { filename: 'splash-828x1792.png', width: 828, height: 1792, scale: '2x' },
    { filename: 'splash-1170x2532.png', width: 1170, height: 2532, scale: '3x' },
    { filename: 'splash-1284x2778.png', width: 1284, height: 2778, scale: '3x' }
  ];

  const contents = {
    images: sizes.map(({ filename, scale }) => ({
      filename,
      idiom: 'universal',
      scale
    })),
    info: { version: 1, author: 'xcode' }
  };

  await Promise.all(
    sizes.map(async ({ filename, width, height }) => {
      const base = await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: brandColor
        }
      })
        .png()
        .toBuffer();

      const splashOverlay = await sharp(splashSource)
        .resize(Math.floor(width * 0.6), Math.floor(height * 0.6), {
          fit: 'contain',
          background: brandColor
        })
        .png()
        .toBuffer();

      const buffer = await sharp(base)
        .composite([{ input: splashOverlay, gravity: 'center' }])
        .png()
        .toBuffer();
      await writeFile(join(iosSplashDir, filename), buffer);
    })
  );

  await writeFile(join(iosSplashDir, 'Contents.json'), JSON.stringify(contents, null, 2));
}

async function generateAndroidIcons() {
  const densities = {
    mdpi: 48,
    hdpi: 72,
    xhdpi: 96,
    xxhdpi: 144,
    xxxhdpi: 192
  };

  const baseBuffer = await buildBaseIcon(1024);

  await Promise.all(
    Object.entries(densities).map(async ([bucket, size]) => {
      const dir = join(androidMipmapBase, `mipmap-${bucket}`);
      await ensureDir(dir);
      const buffer = await sharp(baseBuffer).resize(size, size).png().toBuffer();
      await writeFile(join(dir, 'ic_launcher.png'), buffer);
      await writeFile(join(dir, 'ic_launcher_round.png'), buffer);
      await writeFile(join(dir, 'ic_launcher_foreground.png'), buffer);
    })
  );
}

async function generateSplashLogo() {
  await ensureDir(androidDrawableDir);
  const splash = await sharp(splashSource)
    .resize(768, 1152, { fit: 'contain', background: brandColor })
    .png()
    .toBuffer();

  await writeFile(join(androidDrawableDir, 'splash_logo.png'), splash);
  await ensureDir(generatedIconDir);
  const maskable = await buildBaseIcon(1024);
  await writeFile(join(generatedIconDir, 'app-icon-1024-maskable.png'), maskable);
}

async function run() {
  await ensureSourceExists(iconSource, 'Icon source');
  await ensureSourceExists(splashSource, 'Splash source');
  await generateIosIcons();
  await generateIosSplash();
  await generateAndroidIcons();
  await generateSplashLogo();
  console.info('Native icon and splash assets generated.');
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
