import {
  seededParkPoints,
  polygonHas
} from '../tirana-environment/surfaceCore.mjs';
import { ribbonExclusion } from '../tirana-street-detail/roadDetailCore.mjs';
export const VEGETATION_BUDGETS = {
  trees: 360,
  shrubs: 600,
  grass: 3600,
  flowers: 500
};
function segmentDistance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)
      )
    );
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
export function footprintFits(polygon, x, z, radius) {
  return (
    polygonHas([x, z], polygon) &&
    polygon.every((ring) =>
      ring.every(
        (a, i) =>
          segmentDistance(x, z, a, ring[(i + 1) % ring.length]) >= radius
      )
    )
  );
}
export function racingVegetationSites(parks, track) {
  const x = track.points.map((p) => p.x),
    z = track.points.map((p) => p.z),
    bounds = [
      Math.min(...x) - 160,
      Math.min(...z) - 160,
      Math.max(...x) + 160,
      Math.max(...z) + 160
    ];
  const blocked = ribbonExclusion(track);
  const near = parks.filter(
    (p) =>
      Math.max(...p[0].map((v) => v[0])) >= bounds[0] &&
      Math.min(...p[0].map((v) => v[0])) <= bounds[2] &&
      Math.max(...p[0].map((v) => v[1])) >= bounds[1] &&
      Math.min(...p[0].map((v) => v[1])) <= bounds[3]
  );
  const result = { trees: [], shrubs: [], grass: [], flowers: [] };
  // Covers the largest GLTF canopy, scale variation and wind displacement.
  for (const [kind, spacing, radius] of [
    ['trees', 10, 5.2],
    ['shrubs', 6, 1.9],
    ['grass', 2.8, 0.75],
    ['flowers', 5, 0.65]
  ]) {
    // Fair per-park quotas stop one large park from consuming the whole city budget.
    const perPark = Math.max(
      12,
      Math.ceil(VEGETATION_BUDGETS[kind] / Math.max(1, near.length))
    );
    for (const polygon of near) {
      const remaining = VEGETATION_BUDGETS[kind] - result[kind].length;
      if (remaining <= 0) break;
      const points = seededParkPoints([polygon], {
        spacing,
        limit: Math.min(perPark, remaining),
        excluded: (x, z) =>
          blocked(x, z, radius) || !footprintFits(polygon, x, z, radius)
      });
      result[kind].push(
        ...points.map((p, i) => ({
          ...p,
          variant: kind === 'trees' ? i % 3 : 0
        }))
      );
    }
  }
  return result;
}
