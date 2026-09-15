import { Box3, Matrix4, Object3D, Vector2, Vector3, Mesh } from 'three';

export type TableSegment = {
  start: Vector2;
  end: Vector2;
  normal: Vector2;
  type: 'rail' | 'cut' | 'jaw';
};
export type TablePocket = { center: Vector2; radius: number; fitError: number };
export type TableCalibration = {
  clothY: number;
  min: Vector2;
  max: Vector2;
  segments: TableSegment[];
  pockets: TablePocket[];
  cushionMeshes: Mesh[];
};

function vertices(mesh: Mesh, relativeTo: Object3D) {
  const transform = new Matrix4()
    .copy(relativeTo.matrixWorld)
    .invert()
    .multiply(mesh.matrixWorld);
  const attribute = mesh.geometry.attributes.position;
  return Array.from({ length: attribute.count }, (_, i) =>
    new Vector3().fromBufferAttribute(attribute, i).applyMatrix4(transform)
  );
}

function hull(points: Vector2[]) {
  const unique = new Map(
    points.map((p) => [`${p.x.toFixed(7)},${p.y.toFixed(7)}`, p])
  );
  const sorted = [...unique.values()].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vector2, a: Vector2, b: Vector2) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Vector2[]) => {
    const result: Vector2[] = [];
    for (const p of list) {
      while (
        result.length >= 2 &&
        cross(result[result.length - 2], result[result.length - 1], p) <= 1e-10
      )
        result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.slice().reverse())];
}

function fitPocket(
  points: Vector2[],
  expected: Vector2,
  maxRadius: number
): TablePocket {
  const unique = [
    ...new Map(
      points
        .filter((p) => p.distanceTo(expected) < maxRadius * 2)
        .map((p) => [`${p.x.toFixed(6)},${p.y.toFixed(6)}`, p])
    ).values()
  ];
  let best: {
    center: Vector2;
    radius: number;
    count: number;
    error: number;
  } | null = null;
  const tolerance = maxRadius * 0.001;
  // Circle consensus rejects straight slate edges and bevels. Geometry is
  // measured from the GLB, without guessed per-pocket placement offsets.
  for (let i = 0; i < unique.length - 2; i++)
    for (let j = i + 1; j < unique.length - 1; j++) {
      const k = j + 1 + ((i * 17 + j * 13) % (unique.length - j - 1));
      const a = unique[i],
        b = unique[j],
        c = unique[k];
      const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
      if (Math.abs(d) < 1e-10) continue;
      const aa = a.lengthSq(),
        bb = b.lengthSq(),
        cc = c.lengthSq();
      const center = new Vector2(
        (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
        (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d
      );
      const radius = center.distanceTo(a);
      if (
        radius < maxRadius * 0.25 ||
        radius > maxRadius ||
        center.distanceTo(expected) > maxRadius
      )
        continue;
      const errors = unique
        .map((p) => Math.abs(p.distanceTo(center) - radius))
        .filter((e) => e < tolerance);
      const error =
        errors.reduce((a, b) => a + b, 0) / Math.max(1, errors.length);
      if (
        !best ||
        errors.length > best.count ||
        (errors.length === best.count && error < best.error)
      )
        best = { center, radius, count: errors.length, error };
    }
  if (!best || best.count < 6)
    throw new Error('Cannot calibrate the Showood pocket cutout');
  return { center: best.center, radius: best.radius, fitError: best.error };
}

/** Measures in root-local coordinates. Only source cushion geometry defines rails. */
export function measurePoolRoyalTable(root: Object3D): TableCalibration {
  root.updateWorldMatrix(true, true);
  const cushions: Mesh[] = [];
  let slate: Mesh | undefined;
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (m.name === 'slate') slate = m;
    if (/^cushion_(long|short)$/.test(m.name)) cushions.push(m);
  });
  if (!slate || cushions.length !== 2)
    throw new Error('Showood slate and cushion meshes are required');
  const slatePoints = vertices(slate, root);
  const clothY = Math.max(...slatePoints.map((p) => p.y));
  const slateBox = new Box3().setFromPoints(slatePoints);
  const center = slateBox.getCenter(new Vector3()),
    size = slateBox.getSize(new Vector3());
  const groups: Vector2[][] = Array.from({ length: 6 }, () => []);
  for (const mesh of cushions)
    for (const p of vertices(mesh, root)) {
      const group =
        mesh.name === 'cushion_long'
          ? (p.x < center.x ? 0 : 2) + (p.z < center.z ? 0 : 1)
          : p.z < center.z
            ? 4
            : 5;
      groups[group].push(new Vector2(p.x, p.z));
    }
  const left = groups[0].concat(groups[1]);
  const right = groups[2].concat(groups[3]);
  const near = groups[4].filter((p) => Math.abs(p.x - center.x) < size.x * 0.2);
  const far = groups[5].filter((p) => Math.abs(p.x - center.x) < size.x * 0.2);
  const min = new Vector2(
    Math.max(...left.map((p) => p.x)),
    Math.max(...near.map((p) => p.y))
  );
  const max = new Vector2(
    Math.min(...right.map((p) => p.x)),
    Math.min(...far.map((p) => p.y))
  );
  const segments: TableSegment[] = [];
  for (const group of groups) {
    const boundary = hull(group);
    for (let i = 0; i < boundary.length; i++) {
      const start = boundary[i],
        end = boundary[(i + 1) % boundary.length];
      const delta = end.clone().sub(start);
      if (delta.length() < 1e-7) continue;
      const normal = new Vector2(delta.y, -delta.x).normalize();
      const midpoint = start.clone().add(end).multiplyScalar(0.5);
      // Keep the actual nose and mouth faces; the back of the cushion faces
      // wood, where a ball cannot enter from the playable surface.
      if (normal.dot(new Vector2(center.x, center.z).sub(midpoint)) < 0)
        continue;
      segments.push({
        start,
        end,
        normal,
        type:
          Math.abs(delta.x) < 1e-5 || Math.abs(delta.y) < 1e-5 ? 'rail' : 'cut'
      });
    }
  }
  const expected = [
    new Vector2(min.x, min.y),
    new Vector2(max.x, min.y),
    new Vector2(min.x, max.y),
    new Vector2(max.x, max.y),
    new Vector2(min.x, center.z),
    new Vector2(max.x, center.z)
  ];
  const top = slatePoints
    .filter((p) => Math.abs(p.y - clothY) < 1e-6)
    .map((p) => new Vector2(p.x, p.z));
  const pockets = expected.map((p) =>
    fitPocket(top, p, (max.x - min.x) * 0.13)
  );
  // Pocket liners/rims are concave. Slice their actual triangles at ball-centre
  // height; a convex hull would incorrectly close the pocket opening.
  const height = clothY + 0.028575;
  const seen = new Set<string>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !/^(pocket_|bevel_1)/.test(mesh.name)) return;
    const points = vertices(mesh, root),
      index = mesh.geometry.index;
    const count = index?.count ?? points.length;
    for (let i = 0; i < count; i += 3) {
      const tri = [0, 1, 2].map(
        (k) => points[index ? index.getX(i + k) : i + k]
      );
      const hits: Vector3[] = [];
      for (let k = 0; k < 3; k++) {
        const a = tri[k],
          b = tri[(k + 1) % 3];
        if ((a.y - height) * (b.y - height) >= 0) continue;
        hits.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
      }
      if (hits.length !== 2 || hits[0].distanceToSquared(hits[1]) < 1e-14)
        continue;
      const normal3 = tri[1]
        .clone()
        .sub(tri[0])
        .cross(tri[2].clone().sub(tri[0]));
      const normal = new Vector2(normal3.x, normal3.z);
      if (normal.lengthSq() < 1e-16) continue;
      normal.normalize();
      const start = new Vector2(hits[0].x, hits[0].z),
        end = new Vector2(hits[1].x, hits[1].z);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      if (!pockets.some((p) => p.center.distanceTo(mid) < p.radius * 2.5))
        continue;
      const key = [start, end]
        .map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`)
        .sort()
        .join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push({ start, end, normal, type: 'jaw' });
    }
  });
  return { clothY, min, max, segments, pockets, cushionMeshes: cushions };
}

/** A uniform fit preserves the source pocket mouths, cushion bevels and UVs. */
export function fitPoolRoyalTable(
  root: Object3D,
  playWidth: number,
  playLength: number,
  clothY: number
) {
  root.position.set(0, 0, 0);
  root.scale.setScalar(1);
  root.rotation.set(0, 0, 0);
  const source = measurePoolRoyalTable(root);
  const width = source.max.x - source.min.x,
    length = source.max.y - source.min.y;
  if (Math.abs(length / width - playLength / playWidth) > 0.005)
    throw new Error('Showood playfield aspect ratio does not match');
  const scale = playLength / length;
  const center = source.min.clone().add(source.max).multiplyScalar(0.5);
  root.scale.setScalar(scale);
  root.position.set(
    -center.x * scale,
    clothY - source.clothY * scale,
    -center.y * scale
  );
  root.updateWorldMatrix(true, true);
  const point = (p: Vector2) => p.clone().sub(center).multiplyScalar(scale);
  const mapping: TableCalibration = {
    clothY,
    min: point(source.min),
    max: point(source.max),
    segments: source.segments.map((s) => ({
      ...s,
      start: point(s.start),
      end: point(s.end)
    })),
    pockets: source.pockets.map((p) => ({
      ...p,
      center: point(p.center),
      radius: p.radius * scale,
      fitError: p.fitError * scale
    })),
    cushionMeshes: source.cushionMeshes
  };
  root.userData.poolRoyalCalibration = {
    width: width * scale,
    length: length * scale,
    scale,
    pocketFitError: Math.max(...mapping.pockets.map((p) => p.fitError))
  };
  return mapping;
}
