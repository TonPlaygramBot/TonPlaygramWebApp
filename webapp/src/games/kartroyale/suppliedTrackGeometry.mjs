import * as THREE from 'three';

// The supplied stack keeps its seven flat tires, dimensions and colour pattern.
// Centers are separated by at least one diameter; the upper row rests on the lower.
export const TIRE_RADIUS = 0.34;
export const TIRE_CENTERS = [
  [-0.70, 0.10, -0.31], [0, 0.10, -0.31], [0.70, 0.10, -0.31],
  [-0.35, 0.10, 0.31], [0.35, 0.10, 0.31],
  [-0.35, 0.26, 0], [0.35, 0.26, 0]
];

function offsetPoint(track, frame, t, lane) {
  const fr = frame(track, t);
  return { x: fr.center.x + fr.right.x * lane, z: fr.center.z + fr.right.z * lane };
}

/** Independently measure each offset edge: inside/outside turns have different
 * lengths. Close with length/count, not a remainder gap at the start line. */
export function tireBarrierLayout(track, frame, pitch = 2.30) {
  if (!(track.width > 0) || !Number.isFinite(pitch) || pitch < 2.2)
    throw new Error('Invalid tire barrier dimensions');
  const samples = 4096, result = [];
  for (const side of [-1, 1]) {
    const lane = side * (track.width / 2 + 1.55);
    const points = Array.from({ length: samples + 1 }, (_, i) => offsetPoint(track, frame, i / samples, lane));
    const distances = [0];
    for (let i = 1; i <= samples; i++) {
      distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
    }
    const length = distances[samples], count = Math.floor(length / pitch);
    if (count < 3) throw new Error('Track edge is too short for tire barriers');
    const spacing = length / count;
    let cursor = 1;
    for (let i = 0; i < count; i++) {
      const distance = i * spacing;
      while (cursor < samples && distances[cursor] < distance) cursor++;
      const span = distances[cursor] - distances[cursor - 1];
      const t = (cursor - 1 + (span > 0 ? (distance - distances[cursor - 1]) / span : 0)) / samples;
      const center = offsetPoint(track, frame, t, lane);
      const before = offsetPoint(track, frame, t - 0.00001, lane);
      const after = offsetPoint(track, frame, t + 0.00001, lane);
      // The long X axis of each stack follows the edge tangent. No random yaw.
      const yaw = Math.atan2(after.x - before.x, after.z - before.z) - Math.PI / 2;
      result.push({ ...center, y: 0.02, yaw, t, side, distance, spacing, edgeLength: length, seed: i + (side > 0 ? 4 : 11) });
    }
  }
  return result;
}

/** Four instanced material batches retain the supplied tire/rim geometry and
 * materials while avoiding thousands of draw calls for the continuous rows. */
export function addTireBarriers(scene, track, M, makeStack, frame) {
  const layout = tireBarrierLayout(track, frame);
  // The attachment repeats its colours every 8 seeds and tire rotations every 5.
  const templates = Array.from({ length: 40 }, (_, i) => makeStack(M, i));
  const buckets = new Map(), transform = new THREE.Object3D();
  const group = new THREE.Group();
  group.name = 'Alpine:TireBarriers';
  for (const item of layout) {
    transform.position.set(item.x, item.y, item.z);
    transform.rotation.set(0, item.yaw, 0);
    transform.updateMatrix();
    const template = templates[item.seed % templates.length];
    template.children.forEach((mesh, index) => {
      mesh.updateMatrix();
      if (!buckets.has(mesh.material)) buckets.set(mesh.material, { geometry: templates[0].children[index % 2].geometry, matrices: [] });
      buckets.get(mesh.material).matrices.push(new THREE.Matrix4().multiplyMatrices(transform.matrix, mesh.matrix));
    });
  }
  for (const [material, { geometry, matrices }] of buckets) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  // Only two geometries remain owned by the batches.
  const retained = new Set([...buckets.values()].map(b => b.geometry));
  const unused = new Set(templates.flatMap(t => t.children.map(m => m.geometry)));
  unused.forEach(g => { if (!retained.has(g)) g.dispose(); });
  scene.add(group);
  return group;
}

/** Joined curb cross-sections share exact curve samples with the asphalt.
 * This closes the seam and avoids straight boxes cutting across the corners. */
export function addCurvedCurbs(scene, track, M, frame) {
  const n = track.samples.length, vertices = [], colors = [];
  const section = (t, side) => {
    const fr = frame(track, t), inner = side * track.width / 2, outer = side * (track.width / 2 + 0.36);
    return [[inner, 0.025], [inner, 0.115], [outer, 0.115], [outer, 0.025]].map(([lane, y]) =>
      [fr.center.x + fr.right.x * lane, y, fr.center.z + fr.right.z * lane]);
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = section(i / n, side), b = section((i + 1) / n, side);
      const color = (Math.floor(i / 3) % 2 ? M.red : M.white).color;
      for (let face = 0; face < 4; face++) {
        const next = (face + 1) % 4;
        const points = [a[face], b[face], a[next], a[next], b[face], b[next]];
        if (side < 0) points.reverse();
        for (const p of points) { vertices.push(...p); colors.push(color.r, color.g, color.b); }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = M.white.clone(); material.vertexColors = true; material.color.setHex(0xffffff);
  const curbs = new THREE.Mesh(geometry, material);
  curbs.name = 'Alpine:JoinedCurbs'; curbs.castShadow = curbs.receiveShadow = true;
  scene.add(curbs);
  return curbs;
}
