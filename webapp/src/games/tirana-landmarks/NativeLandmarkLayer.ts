import * as THREE from 'three';
import {buildNativeModel, MATERIALS} from './nativeModels.mjs';
import type {NativeLandmark} from './nativeLocations.mjs';

/** Synchronous, self-contained meshes: no download, decoder, credential or load
 * race. Each landmark is batched by material with near/far camera-selected LOD. */
export class NativeLandmarkLayer {
  readonly group = new THREE.Group();
  readonly lods: THREE.LOD[] = [];
  private disposed = false;
  constructor(readonly locations: readonly NativeLandmark[]) {
    this.group.name = 'Tirana:original-landmark-recreations';
    this.group.userData.provenance = 'Original approximate meshes; not Google Earth scans';
    const materials = new Map<string, THREE.MeshStandardMaterial>();
    for (const l of locations) {
      const lod = new THREE.LOD();
      lod.name = `Tirana:${l.id}`;
      lod.position.set(l.x, l.groundY, l.z);
      lod.rotation.y = l.yaw;
      lod.userData = {...l};
      for (const detail of ['near', 'far'] as const) {
        const data = buildNativeModel(l.id, detail), group = new THREE.Group();
        group.name = `${l.id}:${detail}`;
        for (const part of data.meshes) {
          if (!materials.has(part.material)) materials.set(part.material,
            new THREE.MeshStandardMaterial(MATERIALS[part.material]));
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
          geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
          geometry.computeBoundingBox();
          geometry.computeBoundingSphere();
          const mesh = new THREE.Mesh(geometry, materials.get(part.material)!);
          mesh.name = `${l.id}:${detail}:${part.material}`;
          mesh.castShadow = detail === 'near';
          mesh.receiveShadow = true;
          group.add(mesh);
        }
        lod.addLevel(group, detail === 'near' ? 0 : (l.id === 'skanderbeg' ? 90 : 190), .12);
      }
      // Tall silhouettes survive farther than small monuments. LOD updates are
      // performed by THREE.WebGLRenderer for the active game camera.
      lod.addLevel(new THREE.Group(), l.id === 'eyes' ? 1800 : 1100, .08);
      this.group.add(lod);
      this.lods.push(lod);
    }
  }
  setBatteryMode(enabled: boolean) {
    for (const lod of this.lods) lod.levels[1].distance = enabled ? 35 : (lod.userData.id === 'skanderbeg' ? 90 : 190);
  }
  /** Detach before the owning scene's disposal to avoid duplicate disposal. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    const geos = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh) {
        geos.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    geos.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    this.group.clear();
  }
}
