import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const AIR_HOCKEY_MODEL_URL = '/assets/airhockey/air-hockey-table.glb';

// Frozen from Air Hockey's existing layout. Never import Pool Royal here:
// changes to either game's assets or dimensions must not affect the other.
export const AIR_HOCKEY_DIMENSIONS = Object.freeze({
  tableWidth: 65.103502464,
  tableLength: 95.4851369472,
  tableThickness: 1.9278,
  tableWall: 2.283372,
  playfieldWidth: 54.2510920224,
  playfieldHeight: 108.5021840448,
  surfaceY: 4.5252836564496315
});

// Measured inner rail edges and playing surface of the supplied Hoven66 GLB.
export const SOURCE_FIELD = Object.freeze({
  centerX: -45.395874,
  centerZ: 373.395584,
  surfaceY: 78.587,
  halfWidth: 67.675,
  halfLength: 117.775,
  goalHalfWidth: 22
});

/** Split welded triangle islands, retaining UV seams and authored normals. */
export function splitAirHockeyGeometry(source: THREE.BufferGeometry) {
  const positions = source.getAttribute('position');
  const indices = source.getIndex();
  if (!positions || !indices) throw new Error('The air hockey model has no indexed geometry.');
  const parents: number[] = [];
  const welds = new Map<string, number>();
  const vertexIds: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map((v) => v.toFixed(3)).join(',');
    if (!welds.has(key)) {
      welds.set(key, parents.length);
      parents.push(parents.length);
    }
    vertexIds.push(welds.get(key)!);
  }
  const root = (start: number) => {
    let i = start;
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  };
  for (let i = 0; i < indices.count; i += 3) {
    const a = root(vertexIds[indices.getX(i)]);
    parents[root(vertexIds[indices.getX(i + 1)])] = a;
    parents[root(vertexIds[indices.getX(i + 2)])] = a;
  }
  const islands = new Map<number, number[]>();
  for (let i = 0; i < indices.count; i += 3) {
    const id = root(vertexIds[indices.getX(i)]);
    if (!islands.has(id)) islands.set(id, []);
    islands.get(id)!.push(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2));
  }
  return [...islands.values()].map((triangles) => {
    const vertices = [...new Set(triangles)];
    const remap = new Map(vertices.map((v, i) => [v, i]));
    const geometry = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = source.getAttribute(name);
      if (!attribute) continue;
      const values = new Float32Array(vertices.length * attribute.itemSize);
      vertices.forEach((v, i) => {
        for (let c = 0; c < attribute.itemSize; c++) {
          values[i * attribute.itemSize + c] = attribute.getComponent(v, c);
        }
      });
      geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
    }
    geometry.setIndex(triangles.map((v) => remap.get(v)!));
    geometry.computeBoundingBox();
    return geometry;
  }).sort((a, b) =>
    b.boundingBox!.getSize(new THREE.Vector3()).lengthSq() -
    a.boundingBox!.getSize(new THREE.Vector3()).lengthSq()
  );
}

export function fitAirHockeyTable(geometry: THREE.BufferGeometry) {
  const sx = AIR_HOCKEY_DIMENSIONS.playfieldWidth / (SOURCE_FIELD.halfWidth * 2);
  const sz = AIR_HOCKEY_DIMENSIONS.playfieldHeight / (SOURCE_FIELD.halfLength * 2);
  geometry.translate(-SOURCE_FIELD.centerX, -SOURCE_FIELD.surfaceY, -SOURCE_FIELD.centerZ);
  // The authored table runs sideways. Orient its end goals toward the two
  // existing players; leave the game's camera and screen input mapping alone.
  geometry.rotateY(Math.PI / 2);
  geometry.scale(sx, Math.sqrt(sx * sz), sz);
  geometry.computeBoundingBox();
  return geometry;
}

export function fitAirHockeyPiece(geometry: THREE.BufferGeometry, radius: number) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  geometry.translate(-center.x, -bounds.min.y, -center.z);
  const scale = radius * 2 / Math.max(size.x, size.z);
  geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox();
  return geometry;
}

export async function loadAirHockeyModel(url = AIR_HOCKEY_MODEL_URL) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const meshes: THREE.Mesh[] = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  if (meshes.length !== 1) throw new Error('Unexpected air hockey model layout.');
  const mesh = meshes[0];
  const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const [table, ...pieces] = splitAirHockeyGeometry(geometry);
  geometry.dispose();
  mesh.geometry.dispose();
  if (!table || pieces.length !== 3) {
    [table, ...pieces].forEach((part) => part?.dispose());
    throw new Error('The table, two mallets and puck could not be separated.');
  }
  pieces.sort((a, b) =>
    b.boundingBox!.getSize(new THREE.Vector3()).y - a.boundingBox!.getSize(new THREE.Vector3()).y
  );
  const material = mesh.material as THREE.MeshStandardMaterial;
  // The upload declares alpha blending despite an opaque playing surface.
  material.transparent = false;
  material.depthWrite = true;
  material.opacity = 1;
  material.emissiveIntensity = 1.15;
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
  if (material.map) material.map.anisotropy = 4;
  return { table: fitAirHockeyTable(table), mallets: pieces.slice(0, 2), puck: pieces[2], material };
}

export function disposeAirHockeyModel(model: Awaited<ReturnType<typeof loadAirHockeyModel>>) {
  [model.table, ...model.mallets, model.puck].forEach((geometry) => geometry.dispose());
  model.material.map?.dispose();
  model.material.emissiveMap?.dispose();
  model.material.dispose();
}
