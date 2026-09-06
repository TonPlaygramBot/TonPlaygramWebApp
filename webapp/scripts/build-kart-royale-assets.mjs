// Original TonPlaygram kart assets, adapting WeaponKartGame's chassis, tire and
// seat components. Offline GLB export; seven material batches per vehicle.
import * as T from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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
const output = fileURLToPath(
  new URL('../public/assets/kart-royale/', import.meta.url)
);
await mkdir(output, { recursive: true });
for (const low of [false, true]) {
  const root = new T.Group(),
    segments = low ? 12 : 32;
  const mats = {
    paint: new T.MeshStandardMaterial({
      name: 'paint',
      color: '#baff29',
      metalness: 0.5,
      roughness: 0.26
    }),
    graphite: new T.MeshStandardMaterial({
      name: 'graphite',
      color: '#20272b',
      metalness: 0.68,
      roughness: 0.34
    }),
    rubber: new T.MeshStandardMaterial({
      name: 'rubber',
      color: '#111419',
      roughness: 0.94
    }),
    metal: new T.MeshStandardMaterial({
      name: 'metal',
      color: '#a7b3bf',
      metalness: 0.9,
      roughness: 0.24
    }),
    visor: new T.MeshStandardMaterial({
      name: 'visor',
      color: '#102e43',
      metalness: 0.8,
      roughness: 0.1
    }),
    suit: new T.MeshStandardMaterial({
      name: 'suit',
      color: '#353d43',
      roughness: 0.78
    }),
    lamp: new T.MeshStandardMaterial({
      name: 'lamp',
      color: '#d8fff3',
      emissive: '#baffaa',
      emissiveIntensity: 1.4
    })
  };
  const add = (g, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new T.Mesh(g, mats[mat]);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    root.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, rx = 0) =>
    add(new T.BoxGeometry(w, h, d), mat, x, y, z, rx);
  const tube = (points, r, mat) =>
    add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        low ? 10 : 32,
        r,
        low ? 5 : 8,
        false
      ),
      mat,
      0,
      0,
      0
    );
  box(1.5, 0.12, 2.7, 'graphite', 0, 0.28, 0);
  box(0.82, 0.26, 0.98, 'paint', 0, 0.45, 0.95, -0.12);
  box(0.92, 0.08, 1.01, 'graphite', 0, 0.6, 0.95, -0.12);
  box(0.13, 0.03, 0.95, 'paint', 0, 0.68, 0.95, -0.12);
  box(1.85, 0.15, 0.35, 'paint', 0, 0.34, 1.42);
  box(2.05, 0.09, 0.24, 'graphite', 0, 0.23, 1.55);
  box(1.55, 0.29, 0.66, 'paint', 0, 0.46, -1.06);
  for (const s of [-1, 1]) {
    box(0.26, 0.2, 1.24, 'paint', s * 0.75, 0.4, 0.06);
    tube(
      [
        [s * 0.65, 0.39, -1.16],
        [s * 0.97, 0.37, -0.5],
        [s * 0.97, 0.37, 0.62],
        [s * 0.63, 0.39, 1.22]
      ],
      0.058,
      'metal'
    );
    box(0.08, 0.36, 0.12, 'graphite', s * 0.6, 0.73, -1.14);
    box(0.22, 0.055, 0.11, 'lamp', s * 0.58, 0.45, 1.59);
    for (const z of [-0.93, 0.99]) {
      add(
        new T.CylinderGeometry(0.34, 0.34, 0.4, segments),
        'rubber',
        s * 1.02,
        0.36,
        z,
        0,
        0,
        Math.PI / 2
      );
      add(
        new T.CylinderGeometry(0.22, 0.22, 0.412, segments),
        'graphite',
        s * 1.02,
        0.36,
        z,
        0,
        0,
        Math.PI / 2
      );
      add(
        new T.CylinderGeometry(0.08, 0.08, 0.43, segments),
        'metal',
        s * 1.02,
        0.36,
        z,
        0,
        0,
        Math.PI / 2
      );
      for (let i = 0; i < 5; i++)
        add(
          new T.BoxGeometry(0.02, 0.32, 0.035),
          'metal',
          s * 1.232,
          0.36,
          z,
          (i / 5) * Math.PI * 2
        );
      if (!low)
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2;
          add(
            new T.BoxGeometry(0.34, 0.016, 0.043),
            'graphite',
            s * 1.02,
            0.36 + Math.cos(a) * 0.337,
            z + Math.sin(a) * 0.337,
            a
          );
        }
      tube(
        [
          [s * 0.18, 0.34, z],
          [s * 0.98, 0.32, z]
        ],
        0.045,
        'metal'
      );
    }
  }
  box(1.86, 0.08, 0.34, 'graphite', 0, 0.94, -1.17, -0.12);
  box(1.7, 0.035, 0.14, 'paint', 0, 1, -1.14);
  box(0.6, 0.13, 0.64, 'rubber', 0, 0.46, -0.12);
  box(0.62, 0.67, 0.14, 'rubber', 0, 0.77, -0.45, -0.18);
  const torso = add(
    new T.SphereGeometry(0.3, segments, low ? 8 : 20),
    'suit',
    0,
    0.87,
    -0.2
  );
  torso.scale.set(0.95, 1.3, 0.67);
  for (const s of [-1, 1]) {
    tube(
      [
        [s * 0.23, 0.99, -0.15],
        [s * 0.34, 0.81, 0.1],
        [s * 0.2, 0.8, 0.44]
      ],
      0.09,
      'suit'
    );
    tube(
      [
        [s * 0.16, 0.63, -0.08],
        [s * 0.19, 0.55, 0.43],
        [s * 0.2, 0.39, 0.8]
      ],
      0.105,
      'suit'
    );
  }
  add(
    new T.SphereGeometry(0.275, segments, low ? 8 : 24),
    'paint',
    0,
    1.35,
    -0.13
  );
  add(
    new T.SphereGeometry(
      0.282,
      segments,
      low ? 6 : 12,
      Math.PI / 2 - 0.95,
      1.9,
      1.02,
      0.74
    ),
    'visor',
    0,
    1.35,
    -0.13
  );
  add(
    new T.TorusGeometry(0.21, 0.035, 8, segments),
    'rubber',
    0,
    0.78,
    0.4,
    -0.52
  );
  tube(
    [
      [0, 0.31, 0.66],
      [0, 0.76, 0.4]
    ],
    0.035,
    'metal'
  );
  box(0.48, 0.37, 0.42, 'metal', 0.33, 0.6, -0.93);
  for (let i = 0; i < 6; i++)
    box(0.5, 0.025, 0.42, 'graphite', 0.33, 0.47 + i * 0.052, -0.93);
  tube(
    [
      [-0.5, 0.55, -0.9],
      [-0.72, 0.6, -1.12],
      [-0.72, 0.51, -1.4]
    ],
    0.06,
    'metal'
  );
  root.updateMatrixWorld(true);
  const groups = new Map();
  root.traverse((m) => {
    if (m.isMesh) {
      let g = m.geometry.clone().applyMatrix4(m.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      g.deleteAttribute('uv');
      const key = m.material.name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(g);
    }
  });
  const merged = new T.Group();
  merged.name = 'Apex_01';
  for (const [key, geometries] of groups) {
    const mesh = new T.Mesh(mergeGeometries(geometries), mats[key]);
    mesh.name = key;
    merged.add(mesh);
  }
  const b = await new GLTFExporter().parseAsync(merged, { binary: true });
  await writeFile(`${output}/${low ? 'apex-lod' : 'apex'}.glb`, Buffer.from(b));
  console.log({
    model: low ? 'LOD' : 'full',
    bytes: b.byteLength,
    batches: merged.children.length
  });
}
