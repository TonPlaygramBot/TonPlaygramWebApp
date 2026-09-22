import { build } from 'esbuild';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const output = resolve(process.argv[2] || '/workspace/domino-royal-layout.html');

// Compact embedded textures only. Every vertex, skin weight, bone and node
// transform is retained byte-for-byte from the locally shipped original GLB.
async function compactAvatar(source) {
  const jsonLength = source.readUInt32LE(12);
  const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8'));
  const binary = source.subarray(28 + jsonLength);
  const imageByView = new Map((document.images || []).map((image) => [image.bufferView, image]));
  const chunks = [];
  let length = 0;
  const sourceGeometry = createHash('sha256');
  const packedGeometry = createHash('sha256');
  for (let index = 0; index < document.bufferViews.length; index++) {
    const view = document.bufferViews[index];
    let bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    const image = imageByView.get(index);
    if (image) {
      const resized = sharp(bytes).resize({ width: 192, height: 192, fit: 'inside', withoutEnlargement: true });
      const metadata = await sharp(bytes).metadata();
      if (metadata.hasAlpha) {
        bytes = await resized.png({ palette: true, colours: 256, compressionLevel: 9 }).toBuffer();
        image.mimeType = 'image/png';
      } else {
        bytes = await resized.jpeg({ quality: 83, chromaSubsampling: '4:4:4' }).toBuffer();
        image.mimeType = 'image/jpeg';
      }
    } else {
      sourceGeometry.update(bytes);
      packedGeometry.update(bytes);
    }
    const padding = (4 - length % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); length += padding; }
    view.byteOffset = length;
    view.byteLength = bytes.length;
    view.buffer = 0;
    chunks.push(bytes);
    length += bytes.length;
  }
  document.buffers = [{ byteLength: length }];
  let json = Buffer.from(JSON.stringify(document));
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const data = Buffer.concat([...chunks, Buffer.alloc((4 - length % 4) % 4)]);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + data.length, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(data.length);
  binaryHeader.writeUInt32LE(0x004e4942, 4);
  const geometrySha256 = packedGeometry.digest('hex');
  if (sourceGeometry.digest('hex') !== geometrySha256) throw new Error('Avatar geometry changed during texture compaction.');
  return { model: Buffer.concat([header, json, binaryHeader, data]), geometrySha256 };
}

const sourceModel = await readFile(resolve(app, 'public/assets/pool-royale/readyplayer.me.glb'));
const { model, geometrySha256 } = await compactAvatar(sourceModel);
const packed = gzipSync(model, { level: 9 }).toString('base64');
const result = await build({
  entryPoints: [resolve(here, 'domino-royal-layout-preview.tsx')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  treeShaking: true,
  external: ['react', 'react-dom/client', 'three', 'three/*'],
  define: { __DOMINO_LAYOUT_MODEL_GZIP__: JSON.stringify(packed) },
  logLevel: 'warning'
});
const js = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const imports = {
  react: 'https://esm.sh/react@18.3.1',
  'react/jsx-runtime': 'https://esm.sh/react@18.3.1/jsx-runtime?external=react',
  'react-dom/client': 'https://esm.sh/react-dom@18.3.1/client?external=react',
  three: 'https://cdn.jsdelivr.net/npm/three@0.164.0/build/three.module.js',
  'three/': 'https://cdn.jsdelivr.net/npm/three@0.164.0/'
};
// Literal fragment: bounded portrait product surface, no document wrapper.
const fragment = `<div id="domino-royal-layout-root"></div>
<style>
#domino-royal-layout-root{width:100%;max-width:440px;margin:0 auto;color:#edf4e9;font-family:Inter,system-ui,-apple-system,sans-serif;color-scheme:dark}
#domino-royal-layout-root *{box-sizing:border-box}
#domino-royal-layout-root .layout-preview{background:#07100f}
#domino-royal-layout-root header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:12px}
#domino-royal-layout-root strong{font-weight:500;letter-spacing:.06em;color:#eed697}
#domino-royal-layout-root .player-controls{display:flex;gap:6px}
#domino-royal-layout-root button{font:inherit;font-weight:500;min-height:44px;min-width:44px;padding:0 10px;color:#edf4e9;border:1px solid #3c5544;border-radius:10px;background:#11281e;touch-action:manipulation}
#domino-royal-layout-root button[aria-pressed=true]{background:#e2cd8f;border-color:#e2cd8f;color:#152b1d}
#domino-royal-layout-root .layout-stage{position:relative;width:100%;aspect-ratio:390/600;overflow:hidden}
#domino-royal-layout-root canvas{display:block;width:100%;height:100%;touch-action:none}
#domino-royal-layout-root footer{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;gap:8px;padding:10px}
#domino-royal-layout-root footer span{text-align:center;color:#c7d8cb}
</style>
<script type="importmap">${JSON.stringify({ imports })}</script>
<script type="module">${js}</script>
`;
const bytes = Buffer.byteLength(fragment);
if (bytes >= 1_000_000) throw new Error(`Layout preview exceeds 1 MB: ${bytes} bytes.`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, fragment);
console.log(JSON.stringify({ output, bytes, sourceModelBytes: sourceModel.length, compactModelBytes: model.length, geometrySha256 }));
