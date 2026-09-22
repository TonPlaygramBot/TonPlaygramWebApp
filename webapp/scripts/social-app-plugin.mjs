import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { buildWallUploadWorker } from './build-wall-upload-worker.mjs';

export function socialAppAssets(bundle) {
  const assets = new Set(['/social-app/index.html', '/social-app/manifest.webmanifest', '/social-app/icon.svg', '/social-app/icon-192.png', '/social-app/icon-512.png']);
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const chunk = bundle[file];
    if (!chunk) throw new Error(`Missing social app dependency: ${file}`);
    assets.add(`/${file}`);
    if (chunk.type !== 'chunk') return;
    for (const css of chunk.viteMetadata?.importedCss || []) assets.add(`/${css}`);
    for (const asset of chunk.viteMetadata?.importedAssets || []) assets.add(`/${asset}`);
    [...chunk.imports, ...chunk.dynamicImports].forEach(visit);
  }
  const entry = Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry && item.facadeModuleId?.replaceAll('\\', '/').endsWith('/social-app/index.html'));
  if (!entry) throw new Error('Social app entry was not built.');
  visit(entry.fileName);
  return [...assets].sort();
}

export function socialAppPlugin() {
  let root;
  return {
    name: 'tonplaygram-social-app',
    configResolved(config) { root = config.root; },
    // Direct Vite builds (including CI) need the shared worker too.
    buildStart() { return buildWallUploadWorker(); },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = req.url?.split('?')[0];
        if (path === '/social-app' || (path?.startsWith('/social-app/') && !path.split('/').pop().includes('.'))) {
          req.url = `/social-app/index.html${req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : ''}`;
        }
        next();
      });
    },
    async generateBundle(_options, bundle) {
      const assets = socialAppAssets(bundle);
      const source = await readFile(resolve(root, 'public/social-app/service-worker.js'), 'utf8');
      const push = await readFile(resolve(root, 'public/pwa/wall-push.js'));
      const uploads = await readFile(resolve(root, 'public/pwa/wall-upload-worker.js'));
      const icon = await readFile(resolve(root, 'public/social-app/icon.svg'));
      const manifest = await readFile(resolve(root, 'public/social-app/manifest.webmanifest'));
      const html = String(bundle['social-app/index.html']?.source || '');
      const version = createHash('sha256').update(JSON.stringify(assets)).update(html).update(source).update(push).update(uploads).update(icon).update(manifest).digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'social-app/service-worker.js', source: source.replace('__SOCIAL_VERSION__', version).replace('/* SOCIAL_ASSETS */ []', JSON.stringify(assets)) });
      for (const size of [192, 512]) this.emitFile({ type: 'asset', fileName: `social-app/icon-${size}.png`, source: await sharp(icon).resize(size, size).png().toBuffer() });
    }
  };
}
