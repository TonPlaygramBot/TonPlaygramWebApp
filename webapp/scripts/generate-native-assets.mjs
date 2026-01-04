import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Jimp from 'jimp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_ICON = path.join(PROJECT_ROOT, 'public/assets/icons/9f14924f-e70c-4728-a9e5-ca25ef4138c8.png');

const ANDROID_RES = path.join(PROJECT_ROOT, 'android/app/src/main/res');
const IOS_ASSETS = path.join(PROJECT_ROOT, 'ios/App/App/Assets.xcassets');
const WEB_BRAND_DIR = path.join(PROJECT_ROOT, 'public/assets/brand');

const BACKGROUND_COLOR = '#0b1224';

async function loadBaseIcon() {
  try {
    return await Jimp.read(SOURCE_ICON);
  } catch (err) {
    console.warn(`Falling back to solid background because ${SOURCE_ICON} is unavailable`, err);
    return new Jimp(1024, 1024, BACKGROUND_COLOR);
  }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function saveSquare(icon, size, dest) {
  const clone = icon
    .clone()
    .contain(
      size,
      size,
      Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE,
      Jimp.RESIZE_BILINEAR
    );
  await ensureDir(path.dirname(dest));
  await clone.writeAsync(dest);
}

async function buildAndroidAssets(icon) {
  const densities = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 }
  ];

  await Promise.all(
    densities.flatMap(({ dir, size }) => [
      saveSquare(icon, size, path.join(ANDROID_RES, dir, 'ic_launcher.png')),
      saveSquare(icon, size, path.join(ANDROID_RES, dir, 'ic_launcher_round.png'))
    ])
  );

  await saveSquare(icon, 432, path.join(ANDROID_RES, 'mipmap-anydpi-v26', 'ic_launcher_foreground.png'));
  await saveSquare(icon, 512, path.join(ANDROID_RES, 'drawable-nodpi', 'splash_logo.png'));

  const adaptiveIcon = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/icon_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
  await ensureDir(path.join(ANDROID_RES, 'mipmap-anydpi-v26'));
  await writeFile(path.join(ANDROID_RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIcon);
  await writeFile(path.join(ANDROID_RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIcon);
}

async function buildIosIcons(icon) {
  const appIconDir = path.join(IOS_ASSETS, 'AppIcon.appiconset');
  const sizes = [
    { size: 20, scales: [2, 3], idiom: 'iphone' },
    { size: 29, scales: [2, 3], idiom: 'iphone' },
    { size: 40, scales: [2, 3], idiom: 'iphone' },
    { size: 60, scales: [2, 3], idiom: 'iphone' },
    { size: 20, scales: [1, 2], idiom: 'ipad' },
    { size: 29, scales: [1, 2], idiom: 'ipad' },
    { size: 40, scales: [1, 2], idiom: 'ipad' },
    { size: 76, scales: [1, 2], idiom: 'ipad' },
    { size: 83.5, scales: [2], idiom: 'ipad' },
    { size: 1024, scales: [1], idiom: 'ios-marketing' }
  ];

  const images = [];
  for (const { size, scales, idiom } of sizes) {
    for (const scale of scales) {
      const pixelSize = size * scale;
      const filename = `AppIcon-${size}@${scale}x.png`;
      await saveSquare(icon, pixelSize, path.join(appIconDir, filename));
      images.push({
        filename,
        idiom,
        scale: `${scale}x`,
        size: `${size}x${size}`
      });
    }
  }

  const contents = {
    images,
    info: {
      author: 'xcode',
      version: 1
    }
  };
  await writeFile(path.join(appIconDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
}

async function buildIosSplash(icon) {
  const splashDir = path.join(IOS_ASSETS, 'Splash.imageset');
  const variants = [
    { name: 'splash-1x.png', scale: '1x', size: 640 },
    { name: 'splash-2x.png', scale: '2x', size: 1280 },
    { name: 'splash-3x.png', scale: '3x', size: 1920 }
  ];

  await Promise.all(
    variants.map(({ name, size }) =>
      saveSquare(icon, size, path.join(splashDir, name))
    )
  );

  const contents = {
    images: variants.map(({ name, scale }) => ({
      filename: name,
      idiom: 'universal',
      scale
    })),
    info: {
      author: 'xcode',
      version: 1
    }
  };
  await writeFile(path.join(splashDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
}

async function buildWebIcons(icon) {
  await ensureDir(WEB_BRAND_DIR);
  await saveSquare(icon, 1024, path.join(WEB_BRAND_DIR, 'app-icon-1024.png'));
}

async function main() {
  const baseIcon = await loadBaseIcon();
  await buildAndroidAssets(baseIcon);
  await buildIosIcons(baseIcon);
  await buildIosSplash(baseIcon);
  await buildWebIcons(baseIcon);
  console.log('Native and web icons refreshed from', path.relative(PROJECT_ROOT, SOURCE_ICON));
}

main().catch((err) => {
  console.error('Failed to generate native assets', err);
  process.exitCode = 1;
});
