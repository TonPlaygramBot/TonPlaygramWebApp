import * as T from 'three';
import {
  roadFootprint,
  roadCurbFootprint,
  racingTireLayout,
  TIRE_RADIUS
} from './racingRoadCore.mjs';
import { nearestPoint } from './simulation.mjs';
import type { Track } from './simulation.mjs';

// Asphalt, rubber, painted rubber and rim values from the supplied code.
export const suppliedAsphalt = () =>
  new T.MeshStandardMaterial({
    color: 0x25292d,
    roughness: 0.92,
    metalness: 0.02
  });
function shape(polygon: number[][][]) {
  const path = new T.Shape(polygon[0].map((p) => new T.Vector2(p[0], -p[1])));
  polygon
    .slice(1)
    .forEach((ring) =>
      path.holes.push(new T.Path(ring.map((p) => new T.Vector2(p[0], -p[1]))))
    );
  return path;
}
export function makeRacingRoad(track: Track) {
  const group = new T.Group();
  group.name = 'Tirana:wide-asphalt-and-supplied-tires';
  const roadMaterial = suppliedAsphalt();
  for (const polygon of roadFootprint(track)) {
    const mesh = new T.Mesh(
      new T.ShapeGeometry(shape(polygon)).rotateX(-Math.PI / 2),
      roadMaterial
    );
    mesh.position.y = 0.045;
    mesh.receiveShadow = true;
    mesh.name = 'Tirana:joined-race-asphalt';
    group.add(mesh);
  }
  const paintTexture = new T.DataTexture(
    new Uint8Array([247, 247, 242, 255, 215, 36, 36, 255]),
    2,
    1,
    T.RGBAFormat
  );
  paintTexture.userData.ephemeral = true;
  paintTexture.colorSpace = T.SRGBColorSpace;
  paintTexture.wrapS = T.RepeatWrapping;
  paintTexture.magFilter = T.NearestFilter;
  paintTexture.needsUpdate = true;
  const curbMaterial = new T.MeshStandardMaterial({
    map: paintTexture,
    roughness: 0.58,
    metalness: 0.03
  });
  for (const polygon of roadCurbFootprint(track)) {
    const indexed = new T.ShapeGeometry(shape(polygon)).rotateX(-Math.PI / 2);
    const geo = indexed.toNonIndexed();
    indexed.dispose();
    const p = geo.getAttribute('position'),
      uv = geo.getAttribute('uv');
    for (let i = 0; i < p.count; i += 3) {
      const distances = [0, 1, 2].map((j) => {
        const n = nearestPoint(track, p.getX(i + j), p.getZ(i + j)),
          a = track.points[n.index];
        return a.distance + Math.hypot(n.x - a.x, n.z - a.z);
      });
      const seam =
        Math.max(...distances) - Math.min(...distances) > track.length / 2;
      distances.forEach((d, j) =>
        uv.setXY(
          i + j,
          (d + (seam && d < track.length / 2 ? track.length : 0)) / 3.2,
          0.5
        )
      );
    }
    const curb = new T.Mesh(geo, curbMaterial);
    curb.position.y = 0.085;
    curb.receiveShadow = true;
    curb.name = 'Tirana:joined-curbs';
    group.add(curb);
  }
  const tires = racingTireLayout(track),
    chunks = new Map<string, typeof tires>();
  for (const tire of tires) {
    const key = `${Math.floor(tire.x / 64)}:${Math.floor(tire.z / 64)}`;
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key)!.push(tire);
  }
  const rubber = new T.MeshStandardMaterial({
    color: 0x090909,
    roughness: 0.94,
    metalness: 0
  });
  const paint = new T.MeshStandardMaterial({
    roughness: 0.58,
    metalness: 0.03
  });
  const dark = new T.MeshStandardMaterial({
    color: 0x06070a,
    roughness: 0.85,
    metalness: 0.05
  });
  const tireGeo = new T.CylinderGeometry(TIRE_RADIUS, TIRE_RADIUS, 0.16, 28),
    rimGeo = new T.CylinderGeometry(0.16, 0.16, 0.18, 18),
    m = new T.Object3D();
  const pattern = [
    0x090909, 0xf7f7f2, 0xd72424, 0x090909, 0xf7f7f2, 0xd72424, 0x090909,
    0xd72424
  ];
  for (const row of chunks.values()) {
    const black: T.Matrix4[] = [],
      painted: { matrix: T.Matrix4; color: number }[] = [],
      rims: T.Matrix4[] = [];
    row.forEach((tire) => {
      for (let tier = 0; tier < 3; tier++) {
        m.position.set(tire.x, 0.14 + tier * 0.16, tire.z);
        m.rotation.set(0, tire.yaw + ((tire.seed + tier) % 5) * 0.18, 0);
        m.updateMatrix();
        const color = pattern[(tire.seed + tier) % 8];
        if (color === 0x090909) black.push(m.matrix.clone());
        else painted.push({ matrix: m.matrix.clone(), color });
        m.position.y += 0.002;
        m.rotation.y = tire.yaw;
        m.updateMatrix();
        rims.push(m.matrix.clone());
      }
    });
    const add = (
      geometry: T.BufferGeometry,
      material: T.Material,
      matrices: T.Matrix4[],
      colors?: number[]
    ) => {
      if (!matrices.length) return;
      const mesh = new T.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => {
        mesh.setMatrixAt(i, matrix);
        if (colors) mesh.setColorAt(i, new T.Color(colors[i]));
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    };
    add(tireGeo, rubber, black);
    add(
      tireGeo,
      paint,
      painted.map((p) => p.matrix),
      painted.map((p) => p.color)
    );
    add(rimGeo, dark, rims);
  }
  group.userData.tireCount = tires.length * 3;
  return group;
}
