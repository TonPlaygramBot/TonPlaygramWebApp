import * as THREE from 'three';

/** Reveal the die through an obstructing torso/parked prop without moving the
 * camera or die. Hands and skin keep their opaque contact silhouette. */
export function createSnakeDiceVisibility(camera: THREE.Camera, dice: THREE.Object3D[], occluders: THREE.Object3D[]) {
  const ray = new THREE.Raycaster();
  const faded = new Map<THREE.Mesh, { original: THREE.Material | THREE.Material[]; copies: THREE.Material[] }>();
  let disposed = false, checkedAt = -Infinity;
  const restore = (mesh: THREE.Mesh) => {
    const state = faded.get(mesh); if (!state) return;
    mesh.material = state.original; state.copies.forEach(material => material.dispose()); faded.delete(mesh);
  };
  return {
    update(now: number) {
      if (disposed || now - checkedAt < 80) return;
      checkedAt = now;
      const meshes: THREE.Mesh[] = [];
      for (const root of occluders) root.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || /body|hand|eye|teeth/i.test(mesh.name)) return;
        for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (!p.visible) return;
        mesh.updateWorldMatrix(true, false);
        if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) (mesh as THREE.SkinnedMesh).computeBoundingSphere();
        meshes.push(mesh);
      });
      const blocked = new Set<THREE.Mesh>();
      const origin = camera.getWorldPosition(new THREE.Vector3());
      for (const die of dice) {
        if (!die.visible) continue;
        const point = die.getWorldPosition(new THREE.Vector3());
        const half = (Number(die.userData.gripHalfExtent) || 0.05) * die.getWorldScale(new THREE.Vector3()).y;
        for (const offset of [new THREE.Vector3(0, half, 0), new THREE.Vector3(half * 0.7, half, 0), new THREE.Vector3(-half * 0.7, half, 0)]) {
          const direction = point.clone().add(offset).sub(origin);
          ray.set(origin, direction.clone().normalize()); ray.far = Math.max(0, direction.length() - half * 0.3);
          ray.intersectObjects(meshes, false).forEach(hit => blocked.add(hit.object as THREE.Mesh));
        }
      }
      for (const mesh of faded.keys()) if (!blocked.has(mesh)) restore(mesh);
      for (const mesh of blocked) {
        if (faded.has(mesh)) continue;
        const original = mesh.material;
        const copies = (Array.isArray(original) ? original : [original]).map(source => {
          const material = source.clone(); material.transparent = true; material.opacity = Math.min(source.opacity, 0.08); material.depthWrite = false; return material;
        });
        mesh.material = Array.isArray(original) ? copies : copies[0]; faded.set(mesh, { original, copies });
      }
    },
    dispose() { if (disposed) return; disposed = true; for (const mesh of faded.keys()) restore(mesh); }
  };
}
