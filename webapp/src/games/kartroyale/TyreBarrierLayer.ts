import * as T from 'three';
import type { Track } from './simulation.mjs';
import { circuitSides } from './trackEdges.mjs';
import { ROAD_SURFACE_Y, TYRE_EDGE_OFFSET } from './roadFeel.mjs';

/** Arc-length spacing prevents clumps at dense corner samples. Small shared
 * instance batches let the camera cull the rest of a long city circuit. */
export function createTyreBarrierLayer(track: Track) {
  const group = new T.Group(); group.name = 'Trackside tyre barriers';
  const points = track.points.map(p => ({ ...p, width: (p.width ?? track.width) + TYRE_EDGE_OFFSET * 2 }));
  const sides = circuitSides(points, track.width / 2 + TYRE_EDGE_OFFSET);
  const geometry = new T.TorusGeometry(.43, .14, 4, 8);
  const material = new T.MeshStandardMaterial({ roughness: .93, metalness: .02 });
  const red = new T.Color('#be302c'), white = new T.Color('#e8e2d6');
  const batches = new Map<string, { x:number; z:number; index:number }[]>();
  for (const side of [sides.left, sides.right]) {
    let remainder = 0, index = 0;
    for (let i = 0; i < side.length; i++) {
      const a = side[i], b = side[(i + 1) % side.length], length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 1e-6) continue;
      let at = remainder;
      for (; at < length; at += .94) {
        const x = a.x + (b.x - a.x) * at / length, z = a.z + (b.z - a.z) * at / length;
        const key = `${Math.floor(x / 64)},${Math.floor(z / 64)}`;
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key)!.push({ x, z, index: index++ });
      }
      remainder = at - length;
    }
  }
  const transform = new T.Object3D(); transform.rotation.x = Math.PI / 2;
  for (const batch of batches.values()) {
    const mesh = new T.InstancedMesh(geometry, material, batch.length * 2);
    let n = 0;
    for (const p of batch) {
      for (let level = 0; level < (p.index % 3 === 0 ? 2 : 1); level++) {
        transform.position.set(p.x, ROAD_SURFACE_Y + .14 + level * .28, p.z);
        transform.updateMatrix(); mesh.setMatrixAt(n, transform.matrix);
        mesh.setColorAt(n++, (Math.floor(p.index / 4) + level) % 2 ? white : red);
      }
    }
    mesh.count = n; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  return group;
}
