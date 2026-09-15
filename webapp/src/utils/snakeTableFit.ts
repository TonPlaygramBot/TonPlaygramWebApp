import * as THREE from 'three';

// Measured against the original seated leg mesh. Cabinet/shelf bases need
// more overhang than open corner legs; thin, open tables keep their profile.
export const SNAKE_TABLE_PROFILES: Record<
  string,
  { topStart: number; baseScale: number }
> = {
  CoffeeTable_01: { topStart: 0.72, baseScale: 0.6 },
  WoodenTable_02: { topStart: 0.85, baseScale: 0.55 },
  chinese_tea_table: { topStart: 0.65, baseScale: 1 },
  coffee_table_round_01: { topStart: 0.86, baseScale: 0.8 },
  gallinera_table: { topStart: 0.82, baseScale: 0.5 },
  gothic_coffee_table: { topStart: 0.75, baseScale: 0.8 },
  modern_coffee_table_01: { topStart: 0.82, baseScale: 0.6 },
  modern_coffee_table_02: { topStart: 0.85, baseScale: 0.6 },
  side_table_01: { topStart: 0.82, baseScale: 0.6 },
  side_table_tall_01: { topStart: 0.92, baseScale: 0.65 },
  small_wooden_table_01: { topStart: 0.8, baseScale: 0.7 }
};

/** Insert vertices at each bend so long cabinet/leg faces follow the fit. */
function sliceAtHeights(
  geometry: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  heights: number[]
) {
  const attributes = Object.entries(geometry.attributes);
  const offsets = new Map<string, number>();
  let stride = 0;
  attributes.forEach(([name, a]) => {
    offsets.set(name, stride);
    stride += a.itemSize;
  });
  const positionOffset = offsets.get('position')!;
  const world = (v: number[]) =>
    new THREE.Vector3().fromArray(v, positionOffset).applyMatrix4(matrix).y;
  const vertex = (index: number) =>
    attributes.flatMap(([, a]) =>
      Array.from({ length: a.itemSize }, (_, c) => a.getComponent(index, c))
    );
  const clip = (polygon: number[][], height: number, above: boolean) => {
    const output: number[][] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        ay = world(a),
        by = world(b);
      const insideA = above ? ay >= height : ay <= height,
        insideB = above ? by >= height : by <= height;
      if (insideA) output.push(a);
      if (insideA !== insideB) {
        const t = (height - ay) / (by - ay);
        output.push(a.map((n, c) => THREE.MathUtils.lerp(n, b[c], t)));
      }
    }
    return output;
  };
  const data: number[][] = attributes.map(() => []),
    result = new THREE.BufferGeometry();
  const count = geometry.index?.count ?? geometry.attributes.position.count;
  for (let i = 0; i < count; i += 3) {
    let polygons = [
      [0, 1, 2].map((k) => vertex(geometry.index?.getX(i + k) ?? i + k))
    ];
    for (const height of heights)
      polygons = polygons.flatMap((p) => {
        const ys = p.map(world);
        if (Math.max(...ys) <= height || Math.min(...ys) >= height) return [p];
        return [clip(p, height, false), clip(p, height, true)].filter(
          (p) => p.length >= 3
        );
      });
    const start = data[0].length / attributes[0][1].itemSize;
    for (const polygon of polygons)
      for (let k = 1; k < polygon.length - 1; k++)
        for (const v of [polygon[0], polygon[k], polygon[k + 1]]) {
          attributes.forEach(([name, a], j) => {
            const offset = offsets.get(name)!;
            for (let c = 0; c < a.itemSize; c++) data[j].push(v[offset + c]);
          });
        }
    if (geometry.groups.length) {
      const group = geometry.groups.find(
        (g) => i >= g.start && i < g.start + g.count
      );
      result.addGroup(
        start,
        data[0].length / attributes[0][1].itemSize - start,
        group?.materialIndex ?? 0
      );
    }
  }
  attributes.forEach(([name, a], i) =>
    result.setAttribute(
      name,
      new THREE.Float32BufferAttribute(data[i], a.itemSize)
    )
  );
  return result;
}

/** Fit the playing surface, rather than the feet, to the seating ring. */
export function fitSnakeTableModel(
  model: THREE.Object3D,
  {
    radius,
    surfaceY,
    groundY,
    assetId = ''
  }: { radius: number; surfaceY: number; groundY: number; assetId?: string }
) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error('Snake table has no measurable footprint');
  }
  const top = new THREE.Box3();
  const point = new THREE.Vector3();
  // Flared feet and shelves must not determine the playable footprint.
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const position = mesh.geometry?.getAttribute('position');
    if (!position) return;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      if (point.y >= bounds.max.y - size.y * 0.08) top.expandByPoint(point);
    }
  });
  const topSize = top.getSize(new THREE.Vector3());
  const center = top.getCenter(new THREE.Vector3());
  const diameter = radius * 2;
  const longest = Math.max(topSize.x, topSize.z);
  // Preserve the long axis; widen narrow coffee/side tables enough for the
  // board, dice lanes and parked weapons without moving players out of reach.
  const width = diameter * Math.max(0.88, topSize.x / longest);
  const depth = diameter * Math.max(0.88, topSize.z / longest);
  const scaleX = width / topSize.x,
    scaleZ = depth / topSize.z;
  const height = surfaceY - groundY;
  const profile = SNAKE_TABLE_PROFILES[assetId];
  const slab = 0.085;
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.geometry?.getAttribute('position')) return;
    // Assets may share buffers in caches. Deform only this table instance.
    mesh.geometry = profile
      ? sliceAtHeights(
          mesh.geometry,
          mesh.matrixWorld,
          [profile.topStart - 0.035, profile.topStart].map(
            (t) => bounds.min.y + size.y * t
          )
        )
      : mesh.geometry.clone();
    const position = mesh.geometry.getAttribute('position');
    const normal = mesh.geometry.getAttribute('normal');
    const inverse = mesh.matrixWorld.clone().invert();
    const toWorldNormal = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld),
      toLocalNormal = toWorldNormal.clone().invert();
    const n = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      const t = (point.y - bounds.min.y) / size.y;
      const blend = profile
        ? THREE.MathUtils.clamp((t - profile.topStart + 0.035) / 0.035, 0, 1)
        : 1;
      const base = profile
        ? THREE.MathUtils.lerp(profile.baseScale, 1, blend)
        : 1;
      const slope =
        profile && blend > 0 && blend < 1
          ? (1 - profile.baseScale) / (size.y * 0.035)
          : 0;
      const sy = profile
        ? (t >= profile.topStart
            ? slab / (1 - profile.topStart)
            : (height - slab) / profile.topStart) / size.y
        : height / size.y;
      if (normal) {
        n.fromBufferAttribute(normal, i).applyMatrix3(toWorldNormal);
        const nx = n.x / (scaleX * base),
          nz = n.z / (scaleZ * base);
        n.set(
          nx,
          (n.y -
            (point.x - center.x) * scaleX * slope * nx -
            (point.z - center.z) * scaleZ * slope * nz) /
            sy,
          nz
        )
          .applyMatrix3(toLocalNormal)
          .normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
      }
      point.x = (point.x - center.x) * scaleX * base;
      point.z = (point.z - center.z) * scaleZ * base;
      point.y = profile
        ? t >= profile.topStart
          ? surfaceY -
            slab +
            ((t - profile.topStart) / (1 - profile.topStart)) * slab
          : groundY + (t / profile.topStart) * (height - slab)
        : groundY + t * height;
      point.applyMatrix4(inverse);
      position.setXYZ(i, point.x, point.y, point.z);
    }
    position.needsUpdate = true;
    if (normal) normal.needsUpdate = true;
    // Normal maps derive their tangent basis from the preserved UVs.
    mesh.geometry.deleteAttribute('tangent');
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
  });
  model.updateMatrixWorld(true);
  return {
    surfaceY,
    groundY,
    radius,
    width,
    depth,
    getOuterRadius(direction: THREE.Vector3) {
      return (
        1 / Math.hypot(direction.x / (width / 2), direction.z / (depth / 2))
      );
    }
  };
}
