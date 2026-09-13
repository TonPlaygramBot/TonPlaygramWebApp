import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export type VisualMissile = { x: number; y: number; z: number; direction: { x: number; y: number; z: number } };
/** One draw call. Local +Y is the nose, matching the simulation direction. */
export class MissileVisuals {
  readonly mesh: T.InstancedMesh;
  private dummy = new T.Object3D();
  private direction = new T.Vector3();
  private up = new T.Vector3(0, 1, 0);
  constructor(scene: T.Object3D, readonly capacity = 8) {
    const parts = [new T.CylinderGeometry(.085, .085, .9, 8), new T.ConeGeometry(.085, .3, 8).translate(0, .6, 0),
      new T.BoxGeometry(.44, .22, .035).translate(0, -.35, 0), new T.BoxGeometry(.035, .22, .44).translate(0, -.35, 0)];
    const geometry = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
    this.mesh = new T.InstancedMesh(geometry, new T.MeshStandardMaterial({ color: 0xd7dad5, metalness: .65, roughness: .4 }), capacity);
    this.mesh.name = 'Tirana:directional-missiles'; this.mesh.count = 0; this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(this.mesh);
  }
  update(missiles: readonly VisualMissile[]) {
    this.mesh.count = 0;
    for (const m of missiles.slice(0, this.capacity)) {
      if (![m.x, m.y, m.z, m.direction.x, m.direction.y, m.direction.z].every(Number.isFinite)) continue;
      this.direction.set(m.direction.x, m.direction.y, m.direction.z);
      if (this.direction.lengthSq() < 1e-8) continue;
      this.dummy.position.set(m.x, m.y, m.z); this.dummy.quaternion.setFromUnitVectors(this.up, this.direction.normalize());
      this.dummy.updateMatrix(); this.mesh.setMatrixAt(this.mesh.count++, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); (this.mesh.material as T.Material).dispose(); }
}
