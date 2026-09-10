import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as T from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import sharp from 'sharp';
const webapp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(webapp, 'scripts/military-vehicles');
const output = path.join(webapp, 'public/assets/kart-royale/military');
fs.mkdirSync(output, { recursive: true });
const tmp = path.join(webapp, '.military-build');
fs.mkdirSync(tmp, { recursive: true });
await build({
  entryPoints: [path.join(source, 'shota.ts'), path.join(source, 'convoy.ts')],
  outdir: tmp,
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm'
});
const { createShota } = await import(path.join(tmp, 'shota.js'));
const { createConvoyVehicle, optimiseVehicle } = await import(
  path.join(tmp, 'convoy.js')
);
globalThis.FileReader = class {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((v) => {
      this.result = v;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((v) => {
      this.result =
        'data:application/octet-stream;base64,' +
        Buffer.from(v).toString('base64');
      this.onloadend?.();
    });
  }
};
const font = new FontLoader().parse(
  JSON.parse(
    fs.readFileSync(
      path.join(
        webapp,
        'node_modules/three/examples/fonts/helvetiker_regular.typeface.json'
      ),
      'utf8'
    )
  )
);
const flag = await sharp(
  path.join(webapp, 'public/assets/kart-royale/albania.svg')
)
  .resize(128, 92)
  .png()
  .toBuffer();
const labels = {
  shota: ['SHOTA', [-0.25, 1.495, 3.136], -0.6, 0.105],
  'brabus-g': ['B', [-0.066, 1.05, 2.267], 0, 0.15],
  defender: ['DEFENDER', [-0.313, 1.225, 2.33], 0, 0.067],
  'brabus-s65': ['B', [-0.048, 0.8, 2.673], 0, 0.12]
};
function badge(root, id) {
  const [text, p, rx, size] = labels[id];
  const o = new T.Mesh(
    new TextGeometry(text, {
      font,
      size,
      depth: 0.005,
      curveSegments: 2,
      bevelEnabled: false
    }),
    new T.MeshStandardMaterial({
      name: 'badge',
      color: id === 'shota' ? 0xa8af8c : 0xb6bdc1,
      roughness: 0.45,
      metalness: 0.7
    })
  );
  o.name = 'identity_badge';
  o.position.set(...p);
  o.rotation.x = rx;
  (root.getObjectByName('body') || root).add(o);
}
const rename = {
  Body: 'body',
  Interior: 'interior',
  Steering_wheel: 'steering_wheel',
  Front_left: 'wheel_fl',
  Front_right: 'wheel_fr',
  Rear_left: 'wheel_rl',
  Rear_right: 'wheel_rr',
  Front_left_steer: 'steer_fl',
  Front_right_steer: 'steer_fr'
};
function adaptShota(root, low) {
  root.traverse((o) => {
    if (rename[o.name]) o.name = rename[o.name];
    if (o.isMesh) {
      const m = o.material;
      if (m.name === 'paint' || m.name === 'paint_dark')
        m.name = 'military_paint';
    }
  });
  if (low) {
    const interior = root.getObjectByName('interior');
    interior?.removeFromParent();
    const drop = [];
    root.traverse((o) => {
      if (o.isMesh && ['bolts', 'metal', 'gauge'].includes(o.material.name))
        drop.push(o);
    });
    drop.forEach((o) => o.removeFromParent());
  }
  for (const s of [-1, 1]) {
    const p = new T.Mesh(
      new T.PlaneGeometry(0.22, 0.158),
      new T.MeshStandardMaterial({
        name: 'albanian_flag',
        color: 0xffffff,
        roughness: 0.7
      })
    );
    p.name = 'Albanian flag';
    p.position.set(s * 0.99, 1.65, 2.3);
    p.rotation.y = (s * Math.PI) / 2;
    root.getObjectByName('body').add(p);
  }
  return root;
}
async function exportGlb(root, id, low) {
  badge(root, id);
  optimiseVehicle(root);
  const g = await new GLTFExporter().parseAsync(root, {
    binary: false,
    trs: true,
    onlyVisible: true
  });
  const buffers = [Buffer.from(g.buffers[0].uri.split(',')[1], 'base64')];
  let cursor = buffers[0].length;
  const append = (buf) => {
    const pad = (4 - (cursor % 4)) % 4;
    if (pad) {
      buffers.push(Buffer.alloc(pad));
      cursor += pad;
    }
    const view = { buffer: 0, byteOffset: cursor, byteLength: buf.length };
    buffers.push(buf);
    cursor += buf.length;
    return view;
  };
  g.images = [];
  g.textures = [];
  g.samplers = [
    { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }
  ];
  function texture(bytes, name) {
    const view = g.bufferViews.length;
    g.bufferViews.push(append(bytes));
    g.images.push({ bufferView: view, mimeType: 'image/png', name });
    g.textures.push({ source: g.images.length - 1, sampler: 0 });
    return g.textures.length - 1;
  }
  const sets = {};
  for (const family of ['paint', 'rubber', ...(low ? [] : ['fabric'])]) {
    const set = {};
    for (const type of low ? ['color'] : ['color', 'normal', 'orm'])
      set[type] = texture(
        fs.readFileSync(path.join(source, `${family}_${type}.png`)),
        `${family}_${type}.png`
      );
    sets[family] = set;
  }
  const flagIndex = id === 'shota' ? texture(flag, 'albania.png') : null;
  for (const m of g.materials) {
    if (m.name === 'albanian_flag') {
      m.pbrMetallicRoughness.baseColorTexture = { index: flagIndex };
      continue;
    }
    const family = m.name === 'military_paint' ? 'paint' : m.name,
      t = sets[family];
    if (t) {
      m.pbrMetallicRoughness.baseColorTexture = { index: t.color };
      if (!low) {
        m.pbrMetallicRoughness.metallicRoughnessTexture = { index: t.orm };
        m.normalTexture = {
          index: t.normal,
          scale: family === 'fabric' ? 0.3 : 0.13
        };
      }
    }
  }
  g.asset.extras = {
    model: id,
    detail: low ? 'opponent LOD' : 'full cockpit model',
    accuracy:
      'Original visual reconstruction, estimated proportions; not factory CAD. Armoured styling does not certify real protective performance.',
    textures: 'Original CC0 1.0 procedural PBR textures',
    blender:
      'Import this GLB using Blender File > Import > glTF 2.0. Blender runtime was not used.'
  };
  let bin = Buffer.concat(buffers);
  if (bin.length % 4)
    bin = Buffer.concat([bin, Buffer.alloc(4 - (bin.length % 4))]);
  g.buffers = [{ byteLength: bin.length }];
  let json = Buffer.from(JSON.stringify(g));
  if (json.length % 4)
    json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 32)]);
  const h = Buffer.alloc(12),
    jh = Buffer.alloc(8),
    bh = Buffer.alloc(8);
  h.writeUInt32LE(0x46546c67);
  h.writeUInt32LE(2, 4);
  h.writeUInt32LE(28 + json.length + bin.length, 8);
  jh.writeUInt32LE(json.length);
  jh.writeUInt32LE(0x4e4f534a, 4);
  bh.writeUInt32LE(bin.length);
  bh.writeUInt32LE(0x004e4942, 4);
  const out = path.join(output, `${id}${low ? '-lod' : ''}.glb`);
  fs.writeFileSync(out, Buffer.concat([h, jh, json, bh, bin]));
  let tris = 0,
    draws = 0;
  root.traverse((o) => {
    if (o.isMesh) {
      draws++;
      tris +=
        (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
    }
  });
  return {
    file: path.basename(out),
    bytes: fs.statSync(out).size,
    triangles: tris,
    drawCalls: draws,
    bounds: new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray()
  };
}
const report = [];
for (const id of Object.keys(labels))
  for (const low of [false, true]) {
    const root =
      id === 'shota'
        ? adaptShota(createShota(), low)
        : createConvoyVehicle(id, low);
    report.push(await exportGlb(root, id, low));
  }
fs.writeFileSync(
  path.join(output, 'manifest.json'),
  JSON.stringify(
    {
      format: 'glTF 2.0',
      generator: 'webapp/scripts/build-military-vehicles.mjs',
      models: report
    },
    null,
    2
  ) + '\n'
);
console.log(JSON.stringify(report, null, 2));
fs.rmSync(tmp, { recursive: true, force: true });
