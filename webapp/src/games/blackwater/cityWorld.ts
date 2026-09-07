import * as THREE from 'three';
import { makeWorld, type World } from './world';
import {
  buildings,
  roads,
  props,
  OBSTACLES,
  MAP,
  START,
  EXTRACTION
} from './shared/layout.mjs';

type Part = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrix: THREE.Matrix4;
};
/** Reassemble the original scene's meshes. No replacement models or materials. */
export function makeCityWorld(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
): World {
  const world = makeWorld(scene, camera, renderer),
    parts: Part[] = [];
  const originalObjects = [...scene.children];
  const p = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    scale = new THREE.Vector3();
  for (const object of originalObjects) {
    if (
      object === camera ||
      object === world.sky ||
      object === world.rain ||
      object === world.extraction ||
      object instanceof THREE.Light ||
      object.type === 'Object3D'
    )
      continue;
    if (object instanceof THREE.InstancedMesh) {
      for (let i = 0; i < object.count; i++) {
        const matrix = new THREE.Matrix4();
        object.getMatrixAt(i, matrix);
        parts.push({
          geometry: object.geometry,
          material: object.material as THREE.Material,
          matrix
        });
      }
    } else if (object instanceof THREE.Mesh) {
      object.updateMatrix();
      parts.push({
        geometry: object.geometry,
        material: object.material as THREE.Material,
        matrix: object.matrix.clone()
      });
    }
    scene.remove(object);
  }
  const templates: Part[][] = Array.from({ length: 10 }, () => []),
    propTemplates: Part[][] = props.map(() => []);
  let roadMaterial: THREE.Material | undefined,
    curbMaterial: THREE.Material | undefined,
    paintMaterial: THREE.Material | undefined,
    boxGeometry: THREE.BufferGeometry | undefined;
  const used = new Set<Part>();
  for (const part of parts) {
    part.matrix.decompose(p, q, scale);
    if (scale.x === 160 && scale.z === 160) {
      roadMaterial = part.material;
      boxGeometry = part.geometry;
    }
    if (Math.abs(scale.x - 4.1) < 0.001 && scale.z === 64)
      curbMaterial = part.material;
    if (Math.abs(p.x - 0.17) < 0.001 && Math.abs(scale.z - 2.6) < 0.001)
      paintMaterial = part.material;
    // All ten original building archetypes, including shutters, AC, signage
    // and roof equipment. Normalize the left facade with a rotation only.
    if (
      Math.abs(p.x) >= 15 &&
      Math.abs(p.x) < 30 &&
      p.z > -38 &&
      p.z < 26 &&
      scale.z < 13
    ) {
      const row = Math.max(0, Math.min(4, Math.round((19 - p.z) / 12.5))),
        side = p.x > 0 ? 1 : -1,
        index = row + (side === 1 ? 0 : 5);
      const matrix = new THREE.Matrix4()
        .makeRotationY(side === 1 ? 0 : Math.PI)
        .multiply(
          new THREE.Matrix4().makeTranslation(
            -side * 22.5,
            0,
            -(19 - row * 12.5)
          )
        )
        .multiply(part.matrix);
      templates[index].push({ ...part, matrix });
      used.add(part);
      continue;
    }
    const index = props.findIndex(
      (v) =>
        Math.abs(p.x - v.sx) < v.w / 2 + 0.25 &&
        Math.abs(p.z - v.sz) < v.d / 2 + 0.25 &&
        p.y > 0 &&
        p.y < v.h + 0.3 &&
        scale.x < 5 &&
        scale.z < 8
    );
    if (index >= 0) {
      const v = props[index];
      propTemplates[index].push({
        ...part,
        matrix: new THREE.Matrix4()
          .makeTranslation(-v.sx, 0, -v.sz)
          .multiply(part.matrix)
      });
      used.add(part);
    }
  }
  const batches = new Map<
    string,
    {
      geometry: THREE.BufferGeometry;
      material: THREE.Material;
      matrices: THREE.Matrix4[];
    }
  >();
  const place = (part: Part, transform: THREE.Matrix4) => {
    const matrix = transform.clone().multiply(part.matrix);
    p.setFromMatrixPosition(matrix);
    const key = `${Math.floor(p.x / 70)}:${Math.floor(p.z / 70)}:${part.geometry.uuid}:${part.material.uuid}`;
    if (!batches.has(key))
      batches.set(key, {
        geometry: part.geometry,
        material: part.material,
        matrices: []
      });
    batches.get(key)!.matrices.push(matrix);
  };
  const transform = (x: number, z: number, rot = 0) =>
    new THREE.Matrix4()
      .makeTranslation(x, 0, z)
      .multiply(new THREE.Matrix4().makeRotationY(rot));
  for (const b of buildings)
    for (const part of templates[b.template])
      place(part, transform(b.x, b.z, b.rot));
  props.forEach((v, i) =>
    propTemplates[i].forEach((part) => place(part, transform(v.x, v.z, v.rot)))
  );
  const unit = new THREE.Matrix4();
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    rot = 0
  ) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot),
      new THREE.Vector3(w, h, d)
    );
    place({ geometry: boxGeometry!, material, matrix }, unit);
  };
  // Preserve asphalt, pavement and lane-paint assets; endpoints and widths come
  // directly from Tirana Streets, including curved roads and intersections.
  box(
    (MAP.minX + MAP.maxX) / 2,
    -0.22,
    (MAP.minZ + MAP.maxZ) / 2,
    MAP.maxX - MAP.minX,
    0.4,
    MAP.maxZ - MAP.minZ,
    curbMaterial!
  );
  for (const road of roads) {
    const dx = road.b[0] - road.a[0],
      dz = road.b[1] - road.a[1],
      length = Math.hypot(dx, dz);
    if (length < 0.05) continue;
    const x = (road.a[0] + road.b[0]) / 2,
      z = (road.a[1] + road.b[1]) / 2,
      rot = Math.atan2(dx, dz);
    box(
      x,
      road.walk ? 0.008 : 0.013,
      z,
      road.w,
      0.018,
      length + 0.04,
      road.walk ? curbMaterial! : roadMaterial!,
      rot
    );
    if (!road.walk && road.w >= 6) {
      for (let t = 3; t < length - 2; t += 6) {
        box(
          road.a[0] + (dx * t) / length,
          0.027,
          road.a[1] + (dz * t) / length,
          0.1,
          0.014,
          2.6,
          paintMaterial!,
          rot
        );
      }
    }
  }
  // Existing puddles and street furniture are relocated onto the local roads.
  for (const part of parts) {
    if (used.has(part)) continue;
    part.matrix.decompose(p, q, scale);
    if (
      p.x < 15 &&
      p.x > -15 &&
      p.z > -33 &&
      p.z < 24 &&
      p.y < 6 &&
      p.y > 0 &&
      scale.x < 4 &&
      scale.z < 8
    ) {
      // Pavement/markings were reconstructed above. Keep only free-standing
      // cylinders, puddles, and light fittings from the original scene.
      if (part.geometry.type === 'BoxGeometry' && p.y < 0.4) continue;
      const nearest = roads
        .filter((r) => !r.walk)
        .reduce(
          (best, r) => {
            const d = Math.hypot(
              (r.a[0] + r.b[0]) / 2 - START.x - p.x,
              (r.a[1] + r.b[1]) / 2 - START.z - p.z
            );
            return d < best.d ? { r, d } : best;
          },
          { r: roads[0], d: Infinity }
        ).r;
      place(
        part,
        transform(
          (nearest.a[0] + nearest.b[0]) / 2,
          (nearest.a[1] + nearest.b[1]) / 2
        )
      );
    }
  }
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(
      batch.geometry,
      batch.material,
      batch.matrices.length
    );
    batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  world.obstacles = [...OBSTACLES];
  world.extraction.position.set(EXTRACTION.x, 0.04, EXTRACTION.z);
  world.sky.position.set(START.x, 0, START.z);
  const sun = originalObjects.find(
    (o) => o instanceof THREE.DirectionalLight
  ) as THREE.DirectionalLight | undefined;
  let shadowX = Infinity,
    shadowZ = Infinity;
  world.update = (position) => {
    const x = Math.round(position.x / 16) * 16,
      z = Math.round(position.z / 16) * 16;
    if (sun && (x !== shadowX || z !== shadowZ)) {
      shadowX = x;
      shadowZ = z;
      sun.position.set(x - 28, 35, z - 45);
      sun.target.position.set(x, 0, z - 8);
      sun.shadow.needsUpdate = true;
    }
  };
  // Keep removed prototype resources owned until teardown, including parts not
  // repeated in the city. Shared geometries/materials are disposed only once.
  const dispose = world.dispose;
  world.dispose = () => {
    dispose();
    const geos = new Set(parts.map((p) => p.geometry)),
      mats = new Set(parts.map((p) => p.material));
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => {
      for (const value of Object.values(m))
        if (value instanceof THREE.Texture) value.dispose();
      m.dispose();
    });
  };
  return world;
}
