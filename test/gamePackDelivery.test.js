import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const read = file => fs.readFileSync(file, 'utf8');

describe('versioned game-pack delivery', () => {
  test('generates deterministic per-file manifests and changes the version when content changes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tonplaygram-pack-'));
    const publicDir = path.join(root, 'public');
    const outputDir = path.join(publicDir, 'pwa', 'game-packs');
    fs.mkdirSync(path.join(publicDir, 'assets', 'demo'), { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'assets', 'demo', 'model.glb'), Buffer.from('first-model'));
    fs.writeFileSync(path.join(publicDir, 'assets', 'demo', 'shared.glb'), Buffer.from('shared-core'));
    fs.writeFileSync(path.join(publicDir, 'assets', 'demo', 'source.zip'), Buffer.from('not-runtime'));
    fs.writeFileSync(path.join(publicDir, 'assets', 'demo', 'poster.webp'), Buffer.from('core-image'));
    fs.writeFileSync(path.join(publicDir, 'assets', 'demo', 'music.mp3'), Buffer.from('core-audio'));

    const { generateGamePackManifests } = await import(
      '../webapp/scripts/generate-game-pack-manifests.mjs'
    );
    const definitions = [
      {
        id: 'demo',
        title: 'Demo',
        description: 'Test pack',
        cover: '/demo.svg',
        route: '/games/demo',
        gameSlugs: ['demo'],
        roots: ['assets/demo'],
        excludeFiles: ['assets/demo/shared.glb'],
        dependencies: []
      }
    ];

    try {
      const firstCatalog = await generateGamePackManifests({
        publicDir,
        outputDir,
        definitions,
        cdnBaseUrl: 'https://cdn.example.com/game-packs'
      });
      const firstManifest = JSON.parse(read(path.join(outputDir, 'demo.json')));

      expect(firstCatalog.packs).toHaveLength(1);
      expect(firstManifest.assets).toHaveLength(1);
      expect(firstManifest.assets[0].url).toBe('/assets/demo/model.glb');
      expect(firstManifest.assets.some(asset => asset.url.endsWith('/shared.glb'))).toBe(false);
      expect(firstManifest.assets.some(asset => asset.url.endsWith('/poster.webp'))).toBe(false);
      expect(firstManifest.assets.some(asset => asset.url.endsWith('/music.mp3'))).toBe(false);
      expect(firstManifest.assets[0].sourceUrl).toBe(
        'https://cdn.example.com/game-packs/assets/demo/model.glb'
      );
      expect(firstManifest.assets[0].sha256).toMatch(/^[a-f0-9]{64}$/);

      fs.writeFileSync(path.join(publicDir, 'assets', 'demo', 'model.glb'), Buffer.from('second-model'));
      const secondCatalog = await generateGamePackManifests({
        publicDir,
        outputDir,
        definitions
      });

      expect(secondCatalog.packs[0].version).not.toBe(firstCatalog.packs[0].version);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });


  test('prunes only CDN-backed pack files and preserves launcher covers', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tonplaygram-native-lite-'));
    const distDir = path.join(root, 'dist');
    const manifestDir = path.join(distDir, 'pwa', 'game-packs');
    const assetDir = path.join(distDir, 'assets', 'demo');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.mkdirSync(assetDir, { recursive: true });
    fs.writeFileSync(path.join(assetDir, 'cover.webp'), Buffer.from('cover'));
    fs.writeFileSync(path.join(assetDir, 'world.glb'), Buffer.from('world'));
    fs.writeFileSync(
      path.join(manifestDir, 'index.json'),
      JSON.stringify({
        source: 'cdn',
        packs: [
          {
            id: 'demo',
            cover: '/assets/demo/cover.webp',
            manifestUrl: '/pwa/game-packs/demo.json'
          }
        ]
      })
    );
    fs.writeFileSync(
      path.join(manifestDir, 'demo.json'),
      JSON.stringify({
        assets: [
          {
            url: '/assets/demo/cover.webp',
            sourceUrl: 'https://cdn.example.com/assets/demo/cover.webp'
          },
          {
            url: '/assets/demo/world.glb',
            sourceUrl: 'https://cdn.example.com/assets/demo/world.glb'
          }
        ]
      })
    );

    try {
      const { pruneNativeGamePacks } = await import(
        '../webapp/scripts/prune-native-game-packs.mjs'
      );
      const report = await pruneNativeGamePacks({ distDir });
      expect(report.removedFiles).toBe(1);
      expect(fs.existsSync(path.join(assetDir, 'cover.webp'))).toBe(true);
      expect(fs.existsSync(path.join(assetDir, 'world.glb'))).toBe(false);
      expect(fs.existsSync(path.join(manifestDir, 'native-prune-report.json'))).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('keeps the native/PWA fetch path, resumable cache and download UI wired together', () => {
    const main = read('webapp/src/main.jsx');
    const manager = read('webapp/src/pwa/gamePackManager.js');
    const workerBridge = read('webapp/public/pwa/game-pack-service-worker.js');
    const games = read('webapp/src/pages/Games.jsx');
    const metadata = read('webapp/scripts/write-build-metadata.mjs');
    const nativeBuild = read('webapp/scripts/build-native-lite.mjs');
    const routeGuard = read('webapp/src/pwa/gamePackRouteGuard.js');
    const preload = read('webapp/src/pwa/preloadGames.js');
    const serviceWorker = read('webapp/public/service-worker.js');
    const generator = read('webapp/scripts/generate-game-pack-manifests.mjs');

    expect(main).toContain('installGamePackFetchInterceptor');
    expect(manager).toContain('findReusableResponse');
    expect(manager).toContain('AbortController');
    expect(manager).toContain('X-TonPlaygram-Asset-Sha256');
    expect(workerBridge).toContain("const PACK_CACHE_PREFIX = 'tonplaygram-pack-'");
    expect(metadata).toContain("importScripts('/pwa/game-pack-service-worker.js')");
    expect(games).toContain('<GamePackManager />');
    expect(games).toContain('VITE_REQUIRE_GAME_PACKS');
    expect(nativeBuild).toContain('GAME_PACK_CDN_BASE_URL');
    expect(routeGuard).toContain('downloadPack');
    expect(routeGuard).toContain('isInstallationTreeAvailable');
    expect(preload).toContain('MANAGED_GAME_ASSET_PREFIXES');
    expect(serviceWorker).toContain('MANAGED_GAME_ASSET_PREFIXES');
    expect(generator).toContain('PACKABLE_EXTENSIONS');
    expect(generator).not.toContain("'.webp'");
    expect(generator).not.toContain("'.mp3'");
  });
});
