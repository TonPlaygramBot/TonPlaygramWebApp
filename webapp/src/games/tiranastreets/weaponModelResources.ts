import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Batch only rigid, full-range, single-material meshes. A complex glTF keeps
 * its original hierarchy, skins, material groups and texture-coordinate sets.
 * Never reduce fidelity merely to make an incompatible merge succeed. */
export function prepareWeaponScene(source: THREE.Group): THREE.Group {
  source.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  let canBatch = true;
  source.traverse((object) => {
    if (!object.visible) canBatch = false;
    if (!(object instanceof THREE.Mesh)) {
      // Lines/points/sprites are not ordinary scene containers.
      if ('geometry' in object || 'material' in object) canBatch = false;
      return;
    }
    meshes.push(object);
    const geometry = object.geometry;
    if (
      object instanceof THREE.SkinnedMesh ||
      Array.isArray(object.material) ||
      (object.morphTargetInfluences?.length ?? 0) > 0 ||
      Object.keys(geometry.morphAttributes).length > 0 ||
      geometry.groups.length > 0 ||
      geometry.drawRange.start !== 0 ||
      geometry.drawRange.count !== Infinity ||
      object.matrixWorld.determinant() <= 0
    ) canBatch = false;
  });
  if (meshes.length === 0) throw new Error('Weapon glTF contains no meshes');
  if (!canBatch || meshes.length === 1) return source;

  const batches = new Map<THREE.Material, Map<string, THREE.BufferGeometry[]>>();
  const temporary = new Set<THREE.BufferGeometry>();
  const output = new THREE.Group();
  try {
    for (const mesh of meshes) {
      const copy = mesh.geometry.clone();
      temporary.add(copy);
      copy.applyMatrix4(mesh.matrixWorld);
      const geometry = copy.index ? copy.toNonIndexed() : copy;
      temporary.add(geometry);
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      // Attribute layout, scalar type and normalization are part of the batch
      // key. Keep color, tangent, uv1/uv2/etc. instead of silently deleting them.
      const signature = Object.keys(geometry.attributes).sort().map((name) => {
        const a = geometry.getAttribute(name);
        return `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
      }).join('|');
      const material = mesh.material as THREE.Material;
      let schemas = batches.get(material);
      if (!schemas) { schemas = new Map(); batches.set(material, schemas); }
      const batch = schemas.get(signature) ?? [];
      batch.push(geometry);
      schemas.set(signature, batch);
    }
    for (const [material, schemas] of batches) {
      for (const geometries of schemas.values()) {
        const merged = mergeGeometries(geometries, false);
        if (!merged) {
          // Source still owns valid resources. Discard only our new geometry.
          output.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
          return source;
        }
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = true;
        output.add(mesh);
      }
    }
    return output;
  } catch (error) {
    output.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    throw error;
  } finally {
    for (const geometry of temporary) geometry.dispose();
  }
}

/** Geometry-only transfer after successful batching; materials/textures remain
 * owned by the cached weapon. Complex/skinned scenes never use this path. */
export function releaseBatchedSourceGeometry(source: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  source.traverse((o) => { if (o instanceof THREE.Mesh) geometries.add(o.geometry); });
  for (const geometry of geometries) geometry.dispose();
}

/** Release privately cloned skeletons, never shared cached geometry or maps. */
export function clearWeaponInstance(group: THREE.Group): void {
  const skeletons = new Set<THREE.Skeleton>();
  group.traverse((o) => { if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton); });
  for (const skeleton of skeletons) skeleton.dispose();
  group.clear();
}

/** Ownership boundary: call only for source scenes owned by this loader. */
export function disposeWeaponResources(roots: readonly THREE.Object3D[]): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  for (const root of roots) root.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) skeletons.add(o.skeleton);
    const drawable = o as THREE.Mesh;
    if (drawable.geometry instanceof THREE.BufferGeometry) geometries.add(drawable.geometry);
    const list = Array.isArray(drawable.material) ? drawable.material : [drawable.material];
    for (const material of list) if (material instanceof THREE.Material) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}
