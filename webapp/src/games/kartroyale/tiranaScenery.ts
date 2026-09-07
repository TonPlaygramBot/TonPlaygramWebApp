import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from '../tiranastreets/shared/world.mjs';
import type { Track } from './simulation.mjs';

export function inside(x: number, z: number, polygon: number[][]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
export function occupied(x: number, z: number) {
  return WORLD.buildings.some((b) => inside(x, z, b.p));
}
const surface = (p: number[][], y: number) => {
  const g = new T.ShapeGeometry(
    new T.Shape(p.map((v) => new T.Vector2(v[0], -v[1])))
  );
  return g.rotateX(-Math.PI / 2).translate(0, y, 0);
};
const strip = (a: number[], b: number[], width: number, y: number) => {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    d = Math.hypot(dx, dz) || 1;
  const nx = ((-dz / d) * width) / 2,
    nz = ((dx / d) * width) / 2;
  return surface(
    [
      [a[0] + nx, a[1] + nz],
      [b[0] + nx, b[1] + nz],
      [b[0] - nx, b[1] - nz],
      [a[0] - nx, a[1] - nz]
    ],
    y
  );
};
function merged(
  geos: T.BufferGeometry[],
  material: T.Material,
  parent: T.Group,
  shadow = false
) {
  if (!geos.length) return;
  const normalized = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const g = mergeGeometries(normalized, false);
  geos.forEach((g) => g.dispose());
  normalized.forEach((g) => g.dispose());
  if (!g) return;
  g.computeBoundingSphere();
  const mesh = new T.Mesh(g, material);
  mesh.receiveShadow = true;
  mesh.castShadow = shadow;
  parent.add(mesh);
}

/** Reuses the exact Tirana Streets footprints, road network, parks and river.
 * Decorative shells are chunked; they never replace the race collision system. */
export class TiranaScenery {
  group = new T.Group();
  private chunks: { group: T.Group; x: number; z: number }[] = [];
  constructor(track: Track) {
    const b = track.bounds,
      near = (x: number, z: number) =>
        x > b[0] - 200 && x < b[2] + 200 && z > b[1] - 200 && z < b[3] + 200;
    const asphalt: T.BufferGeometry[] = [],
      walk: T.BufferGeometry[] = [],
      curbs: T.BufferGeometry[] = [],
      park: T.BufferGeometry[] = [],
      water: T.BufferGeometry[] = [];
    for (const r of WORLD.roads) {
      if (!near(r.a[0], r.a[1]) && !near(r.b[0], r.b[1])) continue;
      (r.walk ? walk : asphalt).push(
        strip(r.a, r.b, r.w, r.walk ? 0.02 : 0.025)
      );
      if (!r.walk) curbs.push(strip(r.a, r.b, r.w + 3.8, 0.012));
    }
    for (const p of WORLD.parks)
      if (p.some((v) => near(v[0], v[1]))) park.push(surface(p, 0.008));
    for (const p of WORLD.areas)
      if (p.some((v) => near(v[0], v[1]))) walk.push(surface(p, 0.015));
    for (const p of WORLD.water) {
      if (Array.isArray(p)) {
        if (p.some((v) => near(v[0], v[1]))) water.push(surface(p, 0.018));
      } else
        p.line.slice(1).forEach((a, i) => {
          if (near(a[0], a[1])) water.push(strip(p.line[i], a, p.width, 0.018));
        });
    }
    merged(
      curbs,
      new T.MeshStandardMaterial({ color: '#bdbaa9', roughness: 1 }),
      this.group
    );
    merged(
      asphalt,
      new T.MeshStandardMaterial({ color: '#626563', roughness: 1 }),
      this.group
    );
    merged(
      walk,
      new T.MeshStandardMaterial({ color: '#c8c2ad', roughness: 1 }),
      this.group
    );
    merged(
      park,
      new T.MeshStandardMaterial({ color: '#6a8050', roughness: 1 }),
      this.group
    );
    merged(
      water,
      new T.MeshStandardMaterial({
        color: '#467a80',
        roughness: 0.24,
        metalness: 0.2
      }),
      this.group
    );
    const colors = [
      '#d3c5ad',
      '#d4b8a6',
      '#bbc7b8',
      '#d6cfae',
      '#97a8b0',
      '#dbb99d'
    ];
    const palette = colors.map((color) => new T.Color(color));
    const wallMaterial = new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84
    });
    const glass = new T.MeshStandardMaterial({
      color: '#456273',
      metalness: 0.35,
      roughness: 0.35
    });
    const buckets = new Map<
      string,
      {
        group: T.Group;
        walls: T.BufferGeometry[][];
        windows: T.BufferGeometry[];
      }
    >();
    for (const building of WORLD.buildings) {
      const p = building.p,
        x = p.reduce((s, p) => s + p[0], 0) / p.length,
        z = p.reduce((s, p) => s + p[1], 0) / p.length;
      if (!near(x, z)) continue;
      // Only the three bespoke landmark shells below replace special buildings.
      if (['pyramid', 'mosque', 'clock'].includes(building.special)) continue;
      const cx = Math.floor(x / 100),
        cz = Math.floor(z / 100),
        key = `${cx}:${cz}`;
      if (!buckets.has(key)) {
        const group = new T.Group();
        this.group.add(group);
        this.chunks.push({ group, x: cx * 100 + 50, z: cz * 100 + 50 });
        buckets.set(key, { group, walls: colors.map(() => []), windows: [] });
      }
      const batch = buckets.get(key)!;
      const shape = new T.Shape(p.map((p) => new T.Vector2(p[0], -p[1])));
      const geo = new T.ExtrudeGeometry(shape, {
        depth: building.h,
        bevelEnabled: false,
        steps: 1
      }).rotateX(-Math.PI / 2);
      geo.clearGroups();
      const color = palette[Number(building.id) % colors.length],
        vertexColors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < vertexColors.length; i += 3) {
        vertexColors[i] = color.r;
        vertexColors[i + 1] = color.g;
        vertexColors[i + 2] = color.b;
      }
      geo.setAttribute('color', new T.BufferAttribute(vertexColors, 3));
      batch.walls[Number(building.id) % colors.length].push(geo);
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          c = p[(i + 1) % p.length],
          dx = c[0] - a[0],
          dz = c[1] - a[1],
          len = Math.hypot(dx, dz);
        if (len < 5 || len > 130) continue;
        for (let y = 3.6; y < Math.min(65, building.h - 1); y += 3.5) {
          const g = new T.BoxGeometry(len - 1.4, 1.25, 0.13)
            .rotateY(-Math.atan2(dz, dx))
            .translate((a[0] + c[0]) / 2, y, (a[1] + c[1]) / 2);
          batch.windows.push(g);
        }
      }
    }
    for (const batch of buckets.values()) {
      merged(batch.walls.flat(), wallMaterial, batch.group, true);
      merged(batch.windows, glass, batch.group);
    }
    const trees: { x: number; z: number }[] = [];
    for (const p of WORLD.parks) {
      const x = p.reduce((s, p) => s + p[0], 0) / p.length,
        z = p.reduce((s, p) => s + p[1], 0) / p.length;
      if (near(x, z) && inside(x, z, p) && !occupied(x, z))
        trees.push({ x, z });
    }
    const trunk = new T.InstancedMesh(
      new T.CylinderGeometry(0.2, 0.28, 3, 6),
      new T.MeshStandardMaterial({ color: '#65503e' }),
      trees.length
    );
    const crown = new T.InstancedMesh(
      new T.IcosahedronGeometry(2.1, 1),
      new T.MeshStandardMaterial({ color: '#527146', roughness: 1 }),
      trees.length
    );
    const matrix = new T.Object3D();
    trees.forEach((p, i) => {
      matrix.position.set(p.x, 1.5, p.z);
      matrix.updateMatrix();
      trunk.setMatrixAt(i, matrix.matrix);
      matrix.position.y = 4;
      matrix.updateMatrix();
      crown.setMatrixAt(i, matrix.matrix);
    });
    this.group.add(trunk, crown);
    this.landmarks(near);
  }
  update(x: number, z: number, performance: boolean) {
    const range = performance ? 180 : 290;
    this.chunks.forEach((c) => {
      c.group.visible = Math.hypot(c.x - x, c.z - z) < range + 72;
    });
  }
  private landmarks(near: (x: number, z: number) => boolean) {
    const stone = new T.MeshStandardMaterial({
      color: '#d8d1bf',
      roughness: 0.8
    });
    const roof = new T.MeshStandardMaterial({
      color: '#7c9797',
      metalness: 0.25,
      roughness: 0.45
    });
    const box = (
      parent: T.Group,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: T.Material = stone
    ) => {
      const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
    };
    for (const l of WORLD.landmarks) {
      if (!near(l.x, l.z) || !['pyramid', 'clock', 'mosque'].includes(l.id))
        continue;
      const g = new T.Group();
      g.position.set(l.x, 0, l.z);
      this.group.add(g);
      if (l.id === 'pyramid') {
        g.rotation.y = 0.19;
        const cone = new T.Mesh(new T.ConeGeometry(37, 19, 4), stone);
        cone.position.y = 9.5;
        cone.rotation.y = Math.PI / 4;
        g.add(cone);
        for (let s = 0; s < 4; s++) {
          const stairs = new T.Group();
          stairs.rotation.y = (s * Math.PI) / 2;
          g.add(stairs);
          for (let n = 0; n < 27; n++)
            box(stairs, 9, 0.7, 1.45, 0, n * 0.68 + 0.35, 35 - n * 1.17);
        }
      } else if (l.id === 'clock') {
        box(g, 6, 27, 6, 0, 13.5, 0);
        box(g, 7.5, 4, 7.5, 0, 29, 0);
        const cap = new T.Mesh(new T.ConeGeometry(5.6, 5, 4), roof);
        cap.position.y = 33;
        cap.rotation.y = Math.PI / 4;
        g.add(cap);
        for (let i = 0; i < 4; i++) {
          const face = new T.Group();
          face.rotation.y = (i * Math.PI) / 2;
          face.position.set(
            Math.sin((i * Math.PI) / 2) * 3.78,
            29,
            Math.cos((i * Math.PI) / 2) * 3.78
          );
          g.add(face);
          const disc = new T.Mesh(
            new T.CircleGeometry(1.25, 16),
            new T.MeshBasicMaterial({ color: '#fff8e4' })
          );
          face.add(disc);
          box(face, 0.09, 0.98, 0.06, 0, 0.35, 0.05, roof);
          box(face, 0.8, 0.09, 0.06, 0.3, 0, 0.05, roof);
        }
      } else {
        box(g, 15, 7, 15, 0, 3.5, 0);
        const dome = new T.Mesh(
          new T.SphereGeometry(7.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          roof
        );
        dome.position.y = 7;
        g.add(dome);
        const spire = new T.Mesh(
          new T.CylinderGeometry(0.8, 1.2, 26, 10),
          stone
        );
        spire.position.set(-10, 13, -5);
        g.add(spire);
        const cap = new T.Mesh(new T.ConeGeometry(1.6, 5, 10), roof);
        cap.position.set(-10, 28, -5);
        g.add(cap);
      }
      g.updateMatrixWorld(true);
      const pieces = new Map<T.Material, T.BufferGeometry[]>();
      g.traverse((o) => {
        if (o instanceof T.Mesh) {
          const material = o.material as T.Material;
          if (!pieces.has(material)) pieces.set(material, []);
          pieces
            .get(material)!
            .push(o.geometry.clone().applyMatrix4(o.matrixWorld));
          o.geometry.dispose();
        }
      });
      const batch = new T.Group();
      for (const [material, geos] of pieces)
        merged(geos, material, batch, true);
      this.group.remove(g);
      this.group.add(batch);
      this.chunks.push({ group: batch, x: l.x, z: l.z });
    }
  }
}
