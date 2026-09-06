// Scaranto's CC0 mechanical kart, converted into a mobile GLB with named pivots.
// Usage: node webapp/scripts/build-kart-royale-assets.mjs /path/to/scaranto-kart.glb
// Original source and checksum: webapp/scripts/kart-royale-sources.json.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  mergeGeometries,
  mergeVertices
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
if (!process.argv[2])
  throw new Error(
    'Provide the Scaranto CC0 source GLB. See docs/kart-royale.md.'
  );
globalThis.FileReader = class {
  readAsArrayBuffer(b) {
    b.arrayBuffer().then((r) => {
      this.result = r;
      this.onloadend?.();
    });
  }
  readAsDataURL(b) {
    b.arrayBuffer().then((r) => {
      this.result = `data:${b.type};base64,${Buffer.from(r).toString('base64')}`;
      this.onloadend?.();
    });
  }
};
const data = await readFile(process.argv[2]);
const { scene } = await new GLTFLoader().parseAsync(
  data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
  ''
);
scene.updateMatrixWorld(true);
const bounds = new T.Box3().setFromObject(scene),
  scale = 0.32;
const centerX = (bounds.min.x + bounds.max.x) / 2;
const out = fileURLToPath(
  new URL('../public/assets/kart-royale/', import.meta.url)
);
await mkdir(out, { recursive: true });
for (const low of [false, true]) {
  const root = new T.Group();
  root.name = 'Apex_02';
  root.userData = {
    source: 'https://poly.pizza/m/fLovOv3TAH',
    author: 'scaranto',
    license: 'CC0-1.0',
    wheelRadius: 0.28
  };
  const body = new T.Group();
  body.name = 'body';
  root.add(body);
  const mats = {
    paint: new T.MeshPhysicalMaterial({
      name: 'paint',
      color: '#baff29',
      metalness: 0.32,
      roughness: 0.3,
      clearcoat: 0.85,
      clearcoatRoughness: 0.16
    }),
    graphite: new T.MeshStandardMaterial({
      name: 'graphite',
      color: '#22282d',
      metalness: 0.42,
      roughness: 0.44
    }),
    metal: new T.MeshStandardMaterial({
      name: 'metal',
      color: '#afb9c4',
      metalness: 0.93,
      roughness: 0.26
    }),
    rubber: new T.MeshStandardMaterial({
      name: 'rubber',
      color: '#17191c',
      roughness: 0.86
    }),
    suit: new T.MeshStandardMaterial({
      name: 'suit',
      color: '#30363c',
      roughness: 0.8
    }),
    visor: new T.MeshPhysicalMaterial({
      name: 'visor',
      color: '#1a333f',
      metalness: 0.82,
      roughness: 0.12,
      clearcoat: 1
    }),
    accent: new T.MeshStandardMaterial({
      name: 'accent',
      color: '#c6402c',
      metalness: 0.4,
      roughness: 0.44
    })
  };
  const wheels = [];
  for (const front of [true, false])
    for (const side of [-1, 1]) {
      const label = `${front ? 'f' : 'r'}${side < 0 ? 'r' : 'l'}`;
      const steer = new T.Group();
      steer.name = 'steer_' + label;
      steer.position.set(side * 0.85, 0.28, front ? 1.15 : -1.135);
      const spin = new T.Group();
      spin.name = 'wheel_' + label;
      steer.add(spin);
      root.add(steer);
      wheels.push({ steer, spin, front });
    }
  const steering = new T.Group();
  steering.name = 'steering_wheel';
  steering.position.set(0, 0.595, -0.105);
  body.add(steering);
  const batches = new Map();
  const addGeometry = (group, key, geometry) => {
    if (low && group.name.startsWith('wheel_') && key === 'metal')
      key = 'graphite';
    if (geometry.index) geometry = geometry.toNonIndexed();
    for (const attr of Object.keys(geometry.attributes))
      if (!['position', 'normal'].includes(attr))
        geometry.deleteAttribute(attr);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    const label = group.name + ':' + key;
    if (!batches.has(label)) batches.set(label, { group, key, geometries: [] });
    batches.get(label).geometries.push(geometry);
  };
  scene.traverse((o) => {
    if (!o.isMesh || o.material.name === 'Material.002') return; // smooth replacement tires below
    const id = Number(o.material.name.split('.')[1]);
    const key = [1, 16].includes(id)
      ? 'paint'
      : [4, 5, 8, 10, 11, 13, 14].includes(id)
        ? 'metal'
        : id === 12
          ? 'accent'
          : 'graphite';
    let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    g.translate(-centerX, -bounds.min.y, 0)
      .rotateY(-Math.PI / 2)
      .scale(scale, scale, scale);
    if (g.index) g = g.toNonIndexed();
    const p = g.attributes.position,
      n = g.attributes.normal;
    const groups = new Map();
    for (let i = 0; i < p.count; i += 3) {
      const centroid = new T.Vector3();
      for (let j = 0; j < 3; j++)
        centroid.add(new T.Vector3().fromBufferAttribute(p, i + j));
      centroid.multiplyScalar(1 / 3);
      const wheel = wheels.find(
        (w) =>
          Math.abs(centroid.x) > 0.66 &&
          Math.abs(centroid.x - w.steer.position.x) < 0.26 &&
          Math.hypot(centroid.y - 0.28, centroid.z - w.steer.position.z) < 0.3
      );
      const group = wheel ? wheel.spin : id === 9 ? steering : body;
      const offset = wheel
        ? wheel.steer.position
        : group === steering
          ? steering.position
          : new T.Vector3();
      if (!groups.has(group)) groups.set(group, { pos: [], norm: [] });
      const dst = groups.get(group);
      for (let j = 0; j < 3; j++) {
        dst.pos.push(
          p.getX(i + j) - offset.x,
          p.getY(i + j) - offset.y,
          p.getZ(i + j) - offset.z
        );
        dst.norm.push(n.getX(i + j), n.getY(i + j), n.getZ(i + j));
      }
    }
    for (const [group, dst] of groups) {
      const geom = new T.BufferGeometry();
      geom.setAttribute('position', new T.Float32BufferAttribute(dst.pos, 3));
      geom.setAttribute('normal', new T.Float32BufferAttribute(dst.norm, 3));
      addGeometry(group, key, geom);
    }
  });
  const mesh = (geo, key, x, y, z, rx = 0, ry = 0, rz = 0, group = body) => {
    const m = new T.Mesh(geo);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.updateMatrix();
    addGeometry(group, key, geo.applyMatrix4(m.matrix));
  };
  const tube = (points, radius, key) =>
    mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        low ? 10 : 24,
        radius,
        low ? 5 : 8
      ),
      key,
      0,
      0,
      0
    );
  for (const { spin, front } of wheels) {
    const width = front ? 0.235 : 0.3;
    const profile = [
      [0.15, -width / 2],
      [0.23, -width / 2],
      [0.267, -width * 0.4],
      [0.28, -width * 0.26],
      [0.28, width * 0.26],
      [0.267, width * 0.4],
      [0.23, width / 2],
      [0.15, width / 2]
    ].map(([r, y]) => new T.Vector2(r, y));
    mesh(
      new T.LatheGeometry(profile, low ? 24 : 48),
      'rubber',
      0,
      0,
      0,
      0,
      0,
      Math.PI / 2,
      spin
    );
    for (const side of [-1, 1]) {
      mesh(
        new T.CylinderGeometry(0.153, 0.153, 0.028, low ? 16 : 32),
        'graphite',
        side * width * 0.4,
        0,
        0,
        0,
        0,
        Math.PI / 2,
        spin
      );
      mesh(
        new T.TorusGeometry(0.187, 0.009, 4, low ? 24 : 48),
        'rubber',
        side * width * 0.51,
        0,
        0,
        0,
        Math.PI / 2,
        0,
        spin
      );
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        mesh(
          new T.CylinderGeometry(0.013, 0.013, 0.032, 6),
          'metal',
          side * width * 0.46,
          Math.sin(a) * 0.097,
          Math.cos(a) * 0.097,
          0,
          0,
          Math.PI / 2,
          spin
        );
      }
    }
  }
  // Keep the familiar TonPlaygram helmeted driver; fit it to the sourced seat.
  const torso = new T.CapsuleGeometry(0.18, 0.21, low ? 3 : 6, low ? 10 : 20);
  torso.scale(1.05, 1, 0.7);
  mesh(torso, 'suit', 0, 0.84, -0.42, 0.15);
  for (const side of [-1, 1]) {
    tube(
      [
        [side * 0.17, 0.92, -0.4],
        [side * 0.27, 0.75, -0.27],
        [side * 0.14, 0.69, -0.1]
      ],
      0.064,
      'suit'
    );
    tube(
      [
        [side * 0.13, 0.59, -0.43],
        [side * 0.2, 0.49, 0.08],
        [side * 0.2, 0.34, 0.53]
      ],
      0.072,
      'suit'
    );
    mesh(
      new T.SphereGeometry(0.076, low ? 8 : 16, low ? 6 : 12),
      'graphite',
      side * 0.14,
      0.69,
      -0.1
    );
    tube(
      [
        [side * 0.095, 1.05, -0.315],
        [side * 0.1, 0.86, -0.283],
        [side * 0.11, 0.68, -0.32]
      ],
      0.019,
      'paint'
    );
  }
  const seg = low ? 16 : 32;
  const helmet = new T.SphereGeometry(0.235, seg, low ? 10 : 24);
  helmet.scale(1, 1.09, 1.04);
  mesh(helmet, 'paint', 0, 1.25, -0.37);
  const visor = new T.SphereGeometry(
    0.243,
    seg,
    low ? 5 : 12,
    Math.PI / 2 - 0.96,
    1.92,
    1.01,
    0.75
  );
  visor.scale(1, 1.09, 1.04);
  mesh(visor, 'visor', 0, 1.25, -0.37);
  tube(
    [
      [-0.63, 0.22, 1.1],
      [-0.72, 0.22, 1.43],
      [-0.46, 0.22, 1.52],
      [0.46, 0.22, 1.52],
      [0.72, 0.22, 1.43],
      [0.63, 0.22, 1.1]
    ],
    0.036,
    'graphite'
  );
  // Small curved front panel reads as a racing kart while keeping mechanical parts visible.
  const shape = new T.Shape();
  shape.moveTo(-0.46, -0.11);
  shape.quadraticCurveTo(-0.6, 0.08, -0.31, 0.15);
  shape.lineTo(0.31, 0.15);
  shape.quadraticCurveTo(0.6, 0.08, 0.46, -0.11);
  shape.closePath();
  mesh(
    new T.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: true,
      bevelSegments: low ? 1 : 3,
      steps: 1,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      curveSegments: low ? 6 : 16
    }),
    'paint',
    0,
    0.24,
    1.24,
    Math.PI / 2
  );
  let triangles = 0,
    draws = 0;
  for (const { group, key, geometries } of batches.values()) {
    const g = mergeVertices(mergeGeometries(geometries));
    const m = new T.Mesh(g, mats[key]);
    m.name = group.name + '_' + key;
    group.add(m);
    triangles += (g.index?.count || g.attributes.position.count) / 3;
    draws++;
  }
  const glb = await new GLTFExporter().parseAsync(root, { binary: true });
  await writeFile(out + (low ? 'apex-lod.glb' : 'apex.glb'), Buffer.from(glb));
  console.log({ lod: low, bytes: glb.byteLength, triangles, draws });
}
