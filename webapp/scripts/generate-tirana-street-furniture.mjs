/** Original modeled city fixtures, exported as local glTF 2.0. No runtime CDN. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as T from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
globalThis.FileReader = class {
  readAsArrayBuffer(b) {
    b.arrayBuffer().then((v) => {
      this.result = v;
      this.onloadend?.();
    });
  }
  readAsDataURL(b) {
    b.arrayBuffer().then((v) => {
      this.result = `data:${b.type};base64,${Buffer.from(v).toString('base64')}`;
      this.onloadend?.();
    });
  }
};
const root = new T.Group();
const mat = (name, color, roughness = 0.8, metalness = 0) =>
  Object.assign(new T.MeshStandardMaterial({ color, roughness, metalness }), {
    name
  });
const bark = mat('Weathered bark', 0xffffff, 1),
  metal = mat('Powder coated steel', 0x354146, 0.5, 0.65),
  wood = mat('Oiled bench timber', 0x7e5537, 0.82),
  concrete = mat('Granite edging', 0xb5b5ad, 0.94),
  white = mat('Reflective enamel', 0xe2e4df, 0.45),
  blue = mat('Street sign blue', 0x155592, 0.48),
  dark = mat('Unlit signal lenses', 0x141b1b, 0.37),
  red = mat('Reflective red border', 0xb52e29, 0.45);
const group = (name) => {
  const g = new T.Group();
  g.name = name;
  root.add(g);
  return g;
};
function mesh(g, geo, m, x, y, z, name = '') {
  const o = new T.Mesh(geo, m);
  o.position.set(x, y, z);
  o.name = name;
  g.add(o);
  return o;
}
function box(g, m, w, h, d, x, y, z, name = '') {
  return mesh(g, new T.BoxGeometry(w, h, d), m, x, y, z, name);
}
function branch(g, a, b, r1, r2, m = bark) {
  const v = new T.Vector3(...b).sub(new T.Vector3(...a));
  const o = mesh(g, new T.CylinderGeometry(r2, r1, v.length(), 7), m, ...a);
  if (m === bark) {
    const uv = o.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++)
      uv.setXY(i, uv.getX(i) * Math.PI * (r1 + r2), uv.getY(i) * v.length());
  }
  o.position.addScaledVector(v, 0.5);
  o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
}
let seed = 4816;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const greens = [0x35552b, 0x547338, 0x6a8343].map((c, i) =>
  mat('Foliage ' + i, c, 0.93)
);
const foliage = mat('Foliage canopy', 0xffffff, 0.93);
foliage.vertexColors = true;
function bake(g) {
  g.updateMatrixWorld(true);
  const batches = new Map();
  for (const o of [...g.children]) {
    if (!o.isMesh) continue;
    const geo = o.geometry.clone().applyMatrix4(o.matrix);
    if (!batches.has(o.material)) batches.set(o.material, []);
    batches.get(o.material).push(geo);
    o.geometry.dispose();
    g.remove(o);
  }
  for (const [m, geos] of batches) {
    const geo = mergeGeometries(geos, false);
    geos.forEach((v) => v.dispose());
    if (geo) g.add(new T.Mesh(geo, m));
  }
}
// Tapered forked trunks and individually shaped leaves replace polygonal balls.
for (const lod of [false, true])
  for (let variant = 0; variant < 3; variant++) {
    seed = 4816 + variant * 93;
    const g = group(
      ['tree_plane', 'tree_linden', 'tree_cypress'][variant] +
        (lod ? '_lod' : '')
    );
    const tall = variant === 2;
    branch(g, [0, 0, 0], [0.08, 4.5, 0], 0.3, 0.07);
    for (let i = 0; i < (tall ? 18 : 13); i++) {
      const a = i * 2.399,
        y = tall ? 1.2 + i * 0.26 : 2.25 + (i % 4) * 0.55;
      const radius = tall ? 0.9 * (1 - i / 23) : 1.5 + rand() * 0.9;
      const end = [
        Math.cos(a) * radius,
        y + (tall ? 0.6 : 1.35),
        Math.sin(a) * radius
      ];
      branch(g, [0.02, y, 0], end, 0.1 * (tall ? 0.5 : 1), 0.02);
      for (let twig = 0; twig < (lod ? 2 : 4); twig++) {
        const angle = a + (twig - 1.5) * 0.65;
        const e = [
          end[0] + Math.cos(angle) * 0.62,
          end[1] + rand() * 0.6,
          end[2] + Math.sin(angle) * 0.62
        ];
        branch(g, end, e, 0.026, 0.008);
        for (let j = 0; j < (lod ? 8 : 17); j++) {
          const r = (tall ? 0.48 : 0.92) * Math.sqrt(rand()),
            theta = rand() * Math.PI * 2;
          const scale = (0.12 + rand() * 0.12) * (lod ? 1.65 : 1);
          const shape = new T.Shape();
          shape.moveTo(0, -scale);
          shape.quadraticCurveTo(
            scale * 0.8,
            -scale * 0.35,
            scale * 0.65,
            scale * 0.2
          );
          shape.lineTo(0, scale);
          shape.quadraticCurveTo(-scale * 0.9, scale * 0.2, 0, -scale);
          const geo = new T.ShapeGeometry(shape, lod ? 1 : 2);
          const colors = new T.Float32BufferAttribute(
            new Float32Array(geo.getAttribute('position').count * 3),
            3
          );
          const color = greens[j % 3].color;
          for (let k = 0; k < colors.count; k++)
            colors.setXYZ(k, color.r, color.g, color.b);
          geo.setAttribute('color', colors);
          geo.rotateX((rand() - 0.5) * 2.2);
          geo.rotateY(rand() * Math.PI * 2);
          geo.rotateZ(rand() * Math.PI * 2);
          mesh(
            g,
            geo,
            foliage,
            e[0] + Math.cos(theta) * r,
            e[1] + (rand() - 0.5) * 0.95,
            e[2] + Math.sin(theta) * r
          );
        }
      }
    }
    bake(g);
    for (const child of g.children)
      if (child.material !== bark) child.material.side = T.DoubleSide;
  }
let g = group('traffic_light');
branch(g, [0, 0, 0], [0, 3.55, 0], 0.075, 0.055, metal);
box(g, metal, 0.49, 1.25, 0.34, 0, 3.45, 0, 'housing');
box(g, metal, 0.23, 0.08, 0.23, 0, 0.06, 0);
for (const [i, y] of [3.83, 3.45, 3.07].entries()) {
  const lens = mesh(
    g,
    new T.CircleGeometry(0.125, 16),
    dark,
    0,
    y,
    0.176,
    ['lens_red', 'lens_amber', 'lens_green'][i]
  );
  const hood = mesh(
    g,
    new T.CylinderGeometry(0.153, 0.153, 0.22, 12, 1, true, 0, Math.PI),
    metal,
    0,
    y + 0.02,
    0.27
  );
  hood.rotation.x = Math.PI / 2;
}
g = group('street_sign');
branch(g, [0, 0, 0], [0, 2.65, 0], 0.055, 0.042, metal);
box(g, blue, 2.4, 0.52, 0.065, 0, 2.48, 0);
box(g, white, 2.43, 0.55, 0.03, 0, 2.48, -0.021);
g = group('road_sign');
branch(g, [0, 0, 0], [0, 2.5, 0], 0.052, 0.038, metal);
const disc = mesh(
  g,
  new T.CylinderGeometry(0.49, 0.49, 0.075, 40),
  red,
  0,
  2.22,
  0
);
disc.rotation.x = Math.PI / 2;
const inner = mesh(g, new T.CircleGeometry(0.395, 40), white, 0, 2.22, 0.043);
g = group('park_bench');
for (let i = 0; i < 5; i++) {
  box(g, wood, 1.9, 0.055, 0.095, 0, 0.49, -0.22 + i * 0.112);
  const back = box(g, wood, 1.9, 0.095, 0.055, 0, 0.65 + i * 0.108, 0.3);
  back.rotation.x = -0.12;
}
for (const x of [-0.73, 0.73]) {
  box(g, metal, 0.07, 0.48, 0.42, x, 0.24, 0);
  box(g, metal, 0.055, 0.33, 0.055, x, 0.66, -0.18);
  box(g, metal, 0.055, 0.05, 0.55, x, 0.82, 0.02);
}
bake(g);
g = group('street_lamp');
branch(g, [0, 0, 0], [0, 6.3, 0], 0.11, 0.055, metal);
branch(g, [0, 6.3, 0], [0, 6.6, 1.1], 0.055, 0.045, metal);
box(g, metal, 0.43, 0.13, 1.08, 0, 6.55, 1.25);
const led = mat('Warm LED diffuser', 0xffedc4, 0.5);
led.emissive.set(0xffd995);
led.emissiveIntensity = 0.5;
box(g, led, 0.34, 0.015, 0.88, 0, 6.477, 1.25);
bake(g);
g = group('litter_bin');
mesh(g, new T.CylinderGeometry(0.32, 0.28, 0.86, 14), metal, 0, 0.48, 0);
mesh(g, new T.CylinderGeometry(0.35, 0.35, 0.065, 14), metal, 0, 0.94, 0);
box(g, dark, 0.32, 0.12, 0.012, 0, 0.8, 0.29);
bake(g);
g = group('bollard');
mesh(g, new T.CylinderGeometry(0.065, 0.09, 0.86, 10), metal, 0, 0.47, 0);
mesh(g, new T.CylinderGeometry(0.068, 0.068, 0.09, 10), white, 0, 0.75, 0);
bake(g);
g = group('tree_grate');
box(g, metal, 1.45, 0.035, 0.18, 0, 0.03, -0.7);
box(g, metal, 1.45, 0.035, 0.18, 0, 0.03, 0.7);
for (const x of [-0.7, 0.7]) box(g, metal, 0.18, 0.035, 1.3, x, 0.03, 0);
for (let x = -0.54; x < 0.6; x += 0.12)
  for (const z of [-0.44, 0.44]) box(g, metal, 0.038, 0.03, 0.48, x, 0.03, z);
bake(g);
g = group('drain');
box(g, metal, 0.55, 0.018, 0.32, 0, 0.01, 0);
for (let i = 0; i < 7; i++)
  box(g, dark, 0.032, 0.021, 0.24, -0.21 + i * 0.07, 0.017, 0);
bake(g);
g = group('iron_railing');
// One 2.6 m bay, running along local Z. Both top rails and vertical bars are real geometry.
for (const z of [-1.3, 1.3]) {
  box(g, metal, 0.085, 1.13, 0.085, 0, 0.565, z);
  box(g, metal, 0.16, 0.035, 0.16, 0, 1.145, z);
  box(g, concrete, 0.22, 0.07, 0.22, 0, 0.035, z);
}
for (const y of [0.26, 1.04]) box(g, metal, 0.055, 0.055, 2.6, 0, y, 0);
for (let z = -1.1; z < 1.2; z += 0.22)
  box(g, metal, 0.026, 0.78, 0.026, 0, 0.65, z);
bake(g);
const dir = fileURLToPath(
  new URL('../public/assets/tirana-streets/', import.meta.url)
);
await mkdir(dir, { recursive: true });
const data = await new GLTFExporter().parseAsync(root, {
  binary: true,
  onlyVisible: true
});
await writeFile(dir + 'street-furniture.glb', Buffer.from(data));
console.log(
  `Generated ${root.children.length} glTF fixtures (${Math.round(data.byteLength / 1024)} KiB)`
);
