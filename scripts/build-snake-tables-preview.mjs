import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import sharp from '../webapp/node_modules/sharp/lib/index.js';
import { MeshoptSimplifier } from '../webapp/node_modules/meshoptimizer/index.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(
  await readFile(
    resolve(root, 'webapp/src/previews/snake/generated/table-snapshots.json'),
    'utf8'
  )
);
await MeshoptSimplifier.ready;
const parts = [],
  dedup = new Map(),
  cache = new Map();
async function pack(mesh, kind) {
  const rawKey = createHash('sha1').update(JSON.stringify(mesh)).digest('hex');
  if (cache.has(rawKey)) return cache.get(rawKey);
  let texture;
  if (mesh.map) {
    const bytes = await sharp(Buffer.from(mesh.map.split(',')[1], 'base64'))
      .resize(64, 64)
      .png({ palette: true, colours: 32 })
      .toBuffer();
    texture = 'data:image/png;base64,' + bytes.toString('base64');
  }
  if (mesh.map && !mesh.uv) {
    const xs = mesh.p.filter((_, i) => i % 3 === 0),
      zs = mesh.p.filter((_, i) => i % 3 === 2),
      ys = mesh.p.filter((_, i) => i % 3 === 1);
    const minX = Math.min(...xs),
      width = Math.max(...xs) - minX;
    const axes = Math.max(...zs) - Math.min(...zs) > 0.0001 ? zs : ys;
    const low = Math.min(...axes),
      height = Math.max(...axes) - low;
    mesh.uv = xs.flatMap((x, i) => [
      (x - minX) / Math.max(width, 0.0001),
      1 - (axes[i] - low) / Math.max(height, 0.0001)
    ]);
  }
  const p = new Float32Array(mesh.p),
    remap = MeshoptSimplifier.generatePositionRemap(p, 3);
  let indices = Uint32Array.from(mesh.i, (i) => (mesh.map ? i : remap[i]));
  const target = kind === 'board' ? 450 : 2400;
  if (indices.length > target && !mesh.map)
    [indices] = MeshoptSimplifier.simplify(indices, p, 3, target, 0.02, [
      'Permissive'
    ]);
  const map = new Map(),
    points = [],
    uv = [],
    compact = [];
  for (const i of indices) {
    if (!map.has(i)) {
      map.set(i, map.size);
      points.push(
        ...Array.from(p.subarray(i * 3, i * 3 + 3), (v) =>
          Math.round(v * 10000)
        )
      );
      if (mesh.uv) uv.push(mesh.uv[i * 2], mesh.uv[i * 2 + 1]);
    }
    compact.push(map.get(i));
  }
  const surfaceColors={CoffeeTable_01:'302822',WoodenTable_02:'754c2e',chinese_tea_table:'94663f',coffee_table_round_01:'d5d6d8',gallinera_table:'6c5139',gothic_coffee_table:'684832',industrial_coffee_table:'6b5035',modern_coffee_table_01:'ad874b',modern_coffee_table_02:'4d3b28',round_wooden_table_02:'725438',side_table_01:'bc925d',side_table_tall_01:'96703b',small_wooden_table_01:'9d7d55'};
  const humanColors={Wolf3D_Head:'d9a27d',Wolf3D_Body:'d9a27d',Wolf3D_Headwear:'484933',Wolf3D_Outfit_Footwear:'3e3027'};
  const color=mesh.c==='ffffff'?(kind==='table'?(surfaceColors[mesh.n]||'694b32'):(humanColors[mesh.n]||mesh.c)):mesh.c;
  const item = {
    p: points,
    i: compact,
    c: color,
    opacity: mesh.opacity,
    ...(mesh.map && uv.length ? { map: texture, uv } : {})
  };
  const key = createHash('sha1').update(JSON.stringify(item)).digest('hex');
  if (!dedup.has(key)) {
    dedup.set(key, parts.length);
    parts.push(item);
  }
  const id = dedup.get(key);
  cache.set(rawKey, id);
  return id;
}
const labels = Object.fromEntries(
  [
    ...(
      await readFile(resolve(root, 'webapp/src/config/murlanThemes.js'), 'utf8')
    ).matchAll(/id: '([^']+)', label: '([^']+)'/g)
  ].map((m) => [m[1], m[2]])
);
const scenes = {};
for (const [id, scene] of Object.entries(source))
  scenes[id] = {
    label: labels[id] || scene.label || id.replaceAll('_', ' '),
    table: await Promise.all(scene.table.map((mesh) => pack(mesh, 'table'))),
    board: await Promise.all(scene.board.map((mesh) => pack(mesh, 'board')))
  };
scenes['murlan-default'].label = 'Octagon Table';
const data = {
  parts,
  scenes,
  seat: await Promise.all(
    source['murlan-default'].seat.map((mesh) => pack(mesh, 'seat'))
  )
};
console.log(
  'Parts',
  parts.length,
  'maps',
  parts.reduce((n, p) => n + (p.map?.length || 0), 0),
  'vertices',
  parts.reduce((n, p) => n + p.p.length / 3, 0)
);
await writeFile(
  resolve(root, 'webapp/src/previews/snake/generated/table-preview-debug.json'),
  JSON.stringify(data)
);
const packed = gzipSync(JSON.stringify(data)).toString('base64');
const built = await build({
  entryPoints: [
    resolve(root, 'webapp/src/previews/snake/SnakeTablesPreview.tsx')
  ],
  bundle: true,
  write: false,
  format: 'esm',
  minify: true,
  define: { __SNAKE_TABLE_DATA__: JSON.stringify(packed) },
  plugins: [
    {
      name: 'preview-cdn',
      setup(b) {
        b.onResolve({ filter: /^(three|react|react-dom)/ }, ({ path }) => ({
          path:
            path === 'three'
              ? 'https://esm.sh/three@0.164.1'
              : path.startsWith('three/')
                ? 'https://esm.sh/three@0.164.1/' + path.slice(6)
                : path === 'react/jsx-runtime'
                    ? 'https://esm.sh/react@18.3.1/jsx-runtime'
                    : path === 'react-dom/client'
                  ? 'https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1'
                  : 'https://esm.sh/react@18.3.1',
          external: true
        }));
      }
    }
  ]
});
const html = (
  await readFile(
    resolve(root, 'scripts/snake-tables-preview.fragment.html'),
    'utf8'
  )
).replace('/* SNAKE_TABLES_PREVIEW */', () => built.outputFiles[0].text);
if (Buffer.byteLength(html) > 1000000)
  throw new Error('Inline preview exceeds 1MB: ' + Buffer.byteLength(html));
const output = process.argv[2] || '/workspace/snake-tables-fit.html';
await writeFile(output, html);
console.log('Built', output, Buffer.byteLength(html), 'bytes');
