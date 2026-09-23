import * as THREE from 'three';
import type { HumanRig } from './poolRoyalReferenceHuman.ts';

/** One load-time refinement of the existing hands. UVs and normalized skin
 * weights are interpolated; no extra avatar downloads or per-frame geometry. */
export function addPoolRoyalHandDetails(human: HumanRig) {
  const handBones = new Set([human.bones.leftHand, human.bones.rightHand,
    ...human.leftFingers, ...human.rightFingers]);
  const meshes: THREE.SkinnedMesh[] = [];
  human.model!.traverse(object => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(object as THREE.SkinnedMesh);
  });
  for (const mesh of meshes) {
    const source = mesh.geometry;
    const { position, normal, uv, skinIndex, skinWeight } = source.attributes;
    if (!source.index || !normal || !uv || !skinIndex || !skinWeight || source.morphAttributes.position?.length) continue;
    const selected = new Set<number>();
    for (let i = 0; i < position.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (handBones.has(mesh.skeleton.bones[skinIndex.getComponent(i, j)])) weight += skinWeight.getComponent(i, j);
      if (weight > 0.8) selected.add(i);
    }
    if (!selected.size) continue;
    // GLTF attributes may be interleaved/normalized. Reading their raw .array
    // would copy neighbouring attributes and corrupt both vertices and joints.
    const unpack = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
      const values: number[] = [];
      for (let i = 0; i < attribute.count; i++) for (let j = 0; j < attribute.itemSize; j++) values.push(attribute.getComponent(i, j));
      return values;
    };
    const positions = unpack(position), normals = unpack(normal);
    const uvs = unpack(uv), joints = unpack(skinIndex), weights = unpack(skinWeight);
    const midpoints = new Map<string, number>();
    const edgeKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
    const midpoint = (a: number, b: number) => {
      const key = edgeKey(a, b);
      if (midpoints.has(key)) return midpoints.get(key)!;
      const pa = new THREE.Vector3().fromBufferAttribute(position, a);
      const pb = new THREE.Vector3().fromBufferAttribute(position, b);
      const na = new THREE.Vector3().fromBufferAttribute(normal, a).normalize();
      const nb = new THREE.Vector3().fromBufferAttribute(normal, b).normalize();
      const middle = pa.clone().lerp(pb, 0.5);
      // Bounded Phong projection rounds the low-poly finger silhouette without
      // shrinking knuckles or changing the original wrist boundary vertices.
      const smooth = middle.clone()
        .addScaledVector(na, -0.35 * middle.clone().sub(pa).dot(na))
        .addScaledVector(nb, -0.35 * middle.clone().sub(pb).dot(nb));
      const index = positions.length / 3;
      positions.push(...smooth.toArray()); normals.push(...na.add(nb).normalize().toArray());
      uvs.push((uv.getX(a) + uv.getX(b)) * 0.5, (uv.getY(a) + uv.getY(b)) * 0.5);
      const influence = new Map<number, number>();
      for (const vertex of [a, b]) for (let j = 0; j < 4; j++) {
        const bone = skinIndex.getComponent(vertex, j);
        influence.set(bone, (influence.get(bone) ?? 0) + skinWeight.getComponent(vertex, j) * 0.5);
      }
      const blend = [...influence].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = blend.reduce((sum, [, w]) => sum + w, 0);
      for (let j = 0; j < 4; j++) { joints.push(blend[j]?.[0] ?? 0); weights.push((blend[j]?.[1] ?? 0) / total); }
      midpoints.set(key, index); return index;
    };
    const triangles = source.index.array;
    for (let i = 0; i < triangles.length; i += 3) {
      const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
      if ([a, b, c].every(index => selected.has(index))) { midpoint(a, b); midpoint(b, c); midpoint(c, a); }
    }
    const indices: number[] = [];
    // Neighbouring wrist triangles share split edges: no holes/T-junctions.
    for (let i = 0; i < triangles.length; i += 3) {
      const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
      const ab = midpoints.get(edgeKey(a, b)), bc = midpoints.get(edgeKey(b, c)), ca = midpoints.get(edgeKey(c, a));
      if (ab !== undefined && bc !== undefined && ca !== undefined) indices.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      else if (ab !== undefined && bc !== undefined) indices.push(a, ab, c, ab, bc, c, ab, b, bc);
      else if (bc !== undefined && ca !== undefined) indices.push(b, bc, a, bc, ca, a, bc, c, ca);
      else if (ca !== undefined && ab !== undefined) indices.push(c, ca, b, ca, ab, b, ca, a, ab);
      else if (ab !== undefined) indices.push(a, ab, c, ab, b, c);
      else if (bc !== undefined) indices.push(b, bc, a, bc, c, a);
      else if (ca !== undefined) indices.push(c, ca, b, ca, a, b);
      else indices.push(a, b, c);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    mesh.geometry = geometry;
    // Original geometry remains owned by the loaded model/other cloned seat.
    addNails(human, mesh);
  }
}

/** Fit nail plates to the actual distal skin; all ten share one skinned draw. */
function addNails(human: HumanRig, skin: THREE.SkinnedMesh) {
  const positions: number[] = [], joints: number[] = [], weights: number[] = [], indices: number[] = [];
  const { skinIndex, skinWeight } = skin.geometry.attributes;
  const distal = [...human.leftFingers, ...human.rightFingers].filter(bone => /(?:Thumb|Index|Middle|Ring|Pinky)3$/.test(bone.name));
  for (const bone of distal) {
    const joint = skin.skeleton.bones.indexOf(bone);
    if (joint < 0) continue;
    const inverse = bone.matrixWorld.clone().invert();
    const localPoints: THREE.Vector3[] = [];
    for (let i = 0; i < skinIndex.count; i++) {
      let weight = 0;
      for (let j = 0; j < 4; j++) if (skinIndex.getComponent(i, j) === joint) weight += skinWeight.getComponent(i, j);
      if (weight > 0.45) localPoints.push(skin.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(skin.matrixWorld).applyMatrix4(inverse));
    }
    if (!localPoints.length) continue;
    const bounds = new THREE.Box3().setFromPoints(localPoints);
    const width = (bounds.max.x - bounds.min.x) * 0.30;
    const length = (bounds.max.y - bounds.min.y) * 0.27;
    const centerY = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.62;
    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const nailZ = bounds.min.z - 0.00025;
    const bind = skin.matrixWorld.clone().invert().multiply(bone.matrixWorld);
    const start = positions.length / 3;
    const add = (x: number, y: number, z: number) => {
      positions.push(...new THREE.Vector3(x, y, z).applyMatrix4(bind).toArray());
      joints.push(joint, 0, 0, 0); weights.push(1, 0, 0, 0);
    };
    add(centerX, centerY, nailZ - 0.0007);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      add(centerX + Math.cos(angle) * width, centerY + Math.sin(angle) * length, nailZ);
      indices.push(start, start + 1 + (i + 1) % 12, start + 1 + i);
    }
  }
  if (!positions.length) return;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0xc7998a, roughness: 0.48, metalness: 0 });
  const nails = new THREE.SkinnedMesh(geometry, material);
  nails.name = 'PoolRoyalFingernails';
  nails.position.copy(skin.position); nails.quaternion.copy(skin.quaternion); nails.scale.copy(skin.scale);
  nails.bind(skin.skeleton, skin.bindMatrix);
  nails.frustumCulled = false; nails.castShadow = true; nails.receiveShadow = true;
  skin.parent!.add(nails);
  // Update the attached bind inverse before character-height measurement.
  // Box3.updateWorldMatrix alone does not call SkinnedMesh.updateMatrixWorld.
  nails.updateMatrixWorld(true);
}
