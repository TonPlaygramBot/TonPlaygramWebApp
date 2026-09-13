import * as THREE from 'three';

export const CHECKERS_TABLE_FIT_VERSION = 1;
export const CHECKERS_TABLE_FOOTPRINTS = Object.freeze({
  'murlan-default': [1.08, 0.62],
  hexagonTable: [1.08, 0.62],
  grandOval: [1.10, 0.62],
  diamondEdge: [1.06, 0.62],
  CoffeeTable_01: [1.08, 0.62],
  WoodenTable_02: [1.08, 0.62],
  chinese_tea_table: [1.08, 0.62],
  coffee_table_round_01: [1.02, 0.62],
  gallinera_table: [1.08, 0.62],
  gothic_coffee_table: [1.08, 0.62],
  industrial_coffee_table: [1.08, 0.62],
  modern_coffee_table_01: [1.08, 0.62],
  modern_coffee_table_02: [1.08, 0.62],
  round_wooden_table_02: [1.02, 0.62],
  side_table_01: [0.86, 0.60],
  side_table_tall_01: [0.86, 0.60],
  small_wooden_table_01: [0.94, 0.60]
} satisfies Record<string, readonly number[]>);

type Vertex = Record<string, number[]>;
type FitOptions = { tableId: string; surfaceY: number; imported?: boolean };

// Split a triangle at a height before fitting. Without these cuts, long legs or
// single-mesh imported tables can bridge the clearance band with a slanted face.
function clipAtHeight(polygon: Vertex[], height: number, above: boolean) {
  const result: Vertex[] = [];
  const inside = (v: Vertex) => above ? v.position[1] >= height : v.position[1] <= height;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const aIn = inside(a), bIn = inside(b);
    if (aIn) result.push(a);
    if (aIn !== bIn) {
      const t = (height - a.position[1]) / (b.position[1] - a.position[1]);
      const vertex: Vertex = {};
      for (const key of Object.keys(a)) vertex[key] = a[key].map((value, component) =>
        THREE.MathUtils.lerp(value, b[key][component], t));
      vertex.position[1] = height;
      result.push(vertex);
    }
  }
  return result;
}

/**
 * Fit each loaded table around the existing seated leg space. The top stays
 * large enough for the unchanged board; the underframe occupies a narrower
 * central footprint. Work in world space so imported rotations/pivots cannot
 * swap the phone's visible width and front-to-back depth.
 *
 * Geometry/UVs/material groups are retained, with an affine fit in each height
 * band. Normals use the deformation Jacobian rather than flattening the model.
 * Only call on an owned template before caching it, or on a new procedural table.
 */
export function fitCheckersTable(model: THREE.Object3D, options: FitOptions) {
  if (model.userData.checkersTableFit?.version === CHECKERS_TABLE_FIT_VERSION) return;
  model.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(Number.isFinite) || size.x <= 0 || size.z <= 0) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const footprint = CHECKERS_TABLE_FOOTPRINTS[options.tableId as keyof typeof CHECKERS_TABLE_FOOTPRINTS] || CHECKERS_TABLE_FOOTPRINTS['murlan-default'];
  const sx = footprint[0] / size.x, sz = footprint[1] / size.z;
  const sy = options.imported ? Math.min(0.30 / Math.max(size.y, 0.001), Math.min(sx, sz)) : 1;
  const yOffset = options.imported ? options.surfaceY - bounds.max.y * sy : 0;
  const neckY = options.surfaceY - 0.050;
  const headY = options.surfaceY - 0.030;
  const baseX = 0.30 / footprint[0], baseZ = 0.18 / footprint[1];
  const retired = new Set<THREE.BufferGeometry>();
  const meshes: THREE.Mesh[] = [];
  model.traverse(node => { if ((node as THREE.Mesh).isMesh) meshes.push(node as THREE.Mesh); });

  for (const mesh of meshes) {
    const source = mesh.geometry;
    if (!source.getAttribute('position')) continue;
    const attributes = Object.entries(source.attributes);
    const arrays: Record<string, number[]> = Object.fromEntries(attributes.map(([name]) => [name, []]));
    const inverseWorld = mesh.matrixWorld.clone().invert();
    const toWorldNormal = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const toLocalNormal = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld).transpose();
    const index = source.index;
    const count = index?.count ?? source.getAttribute('position').count;
    const groups = source.groups.length ? source.groups : [{ start: 0, count, materialIndex: 0 }];
    const geometry = new THREE.BufferGeometry();
    const read = (i: number): Vertex => {
      const vertex: Vertex = {};
      for (const [name, attribute] of attributes) {
        vertex[name] = Array.from({ length: attribute.itemSize }, (_, component) => attribute.getComponent(i, component));
      }
      const p = new THREE.Vector3().fromArray(vertex.position).applyMatrix4(mesh.matrixWorld);
      vertex.position = [(p.x - center.x) * sx, p.y * sy + yOffset, (p.z - center.z) * sz];
      if (vertex.normal) {
        const n = new THREE.Vector3().fromArray(vertex.normal).applyMatrix3(toWorldNormal);
        vertex.normal = n.set(n.x / sx, n.y / sy, n.z / sz).normalize().toArray();
      }
      return vertex;
    };
    const write = (vertex: Vertex) => {
      const [x, y, z] = vertex.position;
      const t = THREE.MathUtils.clamp((y - neckY) / (headY - neckY), 0, 1);
      const fx = THREE.MathUtils.lerp(baseX, 1, t), fz = THREE.MathUtils.lerp(baseZ, 1, t);
      const point = new THREE.Vector3(x * fx, y, z * fz).applyMatrix4(inverseWorld);
      arrays.position.push(point.x, point.y, point.z);
      for (const [name] of attributes) {
        if (name === 'position') continue;
        if (name === 'normal') {
          const slope = y > neckY && y < headY ? 1 / (headY - neckY) : 0;
          const [nx, ny, nz] = vertex.normal;
          const normal = new THREE.Vector3(nx / fx, ny - (1 - baseX) * slope * x * nx / fx - (1 - baseZ) * slope * z * nz / fz, nz / fz);
          normal.applyMatrix3(toLocalNormal).normalize();
          arrays.normal.push(normal.x, normal.y, normal.z);
        } else arrays[name].push(...vertex[name]);
      }
    };
    for (const group of groups) {
      const start = arrays.position.length / 3;
      for (let i = group.start; i + 2 < Math.min(count, group.start + group.count); i += 3) {
        const triangle = [0, 1, 2].map(j => read(index ? index.getX(i + j) : i + j));
        const minY = Math.min(...triangle.map(vertex => vertex.position[1]));
        const maxY = Math.max(...triangle.map(vertex => vertex.position[1]));
        const polygons = maxY <= neckY || minY >= headY ? [triangle] : [
          minY < neckY ? clipAtHeight(triangle, neckY, false) : [],
          clipAtHeight(clipAtHeight(triangle, neckY, true), headY, false),
          maxY > headY ? clipAtHeight(triangle, headY, true) : []
        ];
        for (const polygon of polygons) for (let j = 1; j + 1 < polygon.length; j++) {
          write(polygon[0]); write(polygon[j]); write(polygon[j + 1]);
        }
      }
      geometry.addGroup(start, arrays.position.length / 3 - start, group.materialIndex);
    }
    for (const [name, attribute] of attributes) geometry.setAttribute(name, new THREE.Float32BufferAttribute(arrays[name], attribute.itemSize));
    // Tangents from the original shape no longer describe the fitted surface.
    // Three derives the normal-map basis from the preserved UVs when absent.
    geometry.deleteAttribute('tangent');
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.geometry = geometry;
    retired.add(source);
  }
  retired.forEach(geometry => geometry.dispose());
  model.userData.checkersTableFit = {
    version: CHECKERS_TABLE_FIT_VERSION, tableId: options.tableId,
    width: footprint[0], depth: footprint[1], baseWidth: 0.30, baseDepth: 0.18
  };
  model.updateWorldMatrix(true, true);
}
