import * as T from 'three';
import type { Track } from './simulation.mjs';
import { ROAD_SURFACE_Y } from './roadFeel.mjs';
import { tyreBarrierLayout, type TyrePosition } from './tyreBarrierCore.mjs';
import {surfaceHeight} from './racingSurface.mjs';

/** Arc-length spacing prevents clumps at dense corner samples. Small shared
 * instance batches let the camera cull the rest of a long city circuit. */
export function createTyreBarrierLayer(track: Track, buildingClearance?: (x:number,z:number)=>number) {
  return createTyreBarrierMeshes(tyreBarrierLayout(track, buildingClearance).positions,(x,z)=>surfaceHeight(track,x,z));
}

/** Also used by the portable preview with the exact validated placements. */
export function createTyreBarrierMeshes(positions: TyrePosition[],height:(x:number,z:number)=>number=()=>0) {
  const group = new T.Group(); group.name = 'Trackside tyre barriers';
  const geometry = new T.TorusGeometry(.43, .14, 6, 12);
  const material = new T.MeshStandardMaterial({ roughness: .93, metalness: .02 });
  const red = new T.Color('#be302c'), white = new T.Color('#e8e2d6');
  const batches = new Map<string, { x:number; z:number; index:number }[]>();
  for (const p of positions) {
    const { x, z } = p;
    const key = `${Math.floor(x / 64)},${Math.floor(z / 64)}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key)!.push(p);
  }
  const transform = new T.Object3D(); transform.rotation.x = Math.PI / 2;
  for (const batch of batches.values()) {
    const mesh = new T.InstancedMesh(geometry, material, batch.length * 2);
    let n = 0;
    for (const p of batch) {
      for (let level = 0; level < (p.index % 3 === 0 ? 2 : 1); level++) {
        transform.position.set(p.x, height(p.x,p.z)+ROAD_SURFACE_Y + .14 + level * .28, p.z);
        transform.updateMatrix(); mesh.setMatrixAt(n, transform.matrix);
        mesh.setColorAt(n++, (Math.floor(p.index / 4) + level) % 2 ? white : red);
      }
    }
    mesh.count = n; mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); group.add(mesh);
  }
  return group;
}
