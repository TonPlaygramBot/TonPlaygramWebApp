import clipping from 'polygon-clipping';
import { roadCorridor } from './surfaceCore.mjs';
import { roadFootprint } from '../kartroyale/racingRoadCore.mjs';
const SCALE = 1000;
const closed = (ring, factor = SCALE) => {
  const points = ring
    .map((p) => [Math.round(p[0] * factor), Math.round(p[1] * factor)])
    .filter(
      (p, i, all) => !i || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]
    );
  if (
    points.length &&
    (points[0][0] !== points.at(-1)[0] || points[0][1] !== points.at(-1)[1])
  )
    points.push(points[0]);
  return points;
};
const snapped = (multi, factor = 1) =>
  multi
    .map((poly) => poly.map((r) => closed(r, factor)))
    .filter((poly) => poly[0].length >= 4);
const bounds = (ring) => [
  Math.min(...ring.map((p) => p[0])),
  Math.min(...ring.map((p) => p[1])),
  Math.max(...ring.map((p) => p[0])),
  Math.max(...ring.map((p) => p[1]))
];
const intersects = (a, b) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
function difference(subject, cuts) {
  if (!cuts.length) return subject;
  try {
    return clipping.difference(subject, ...cuts);
  } catch {
    // Near-coincident recorded road edges can destabilize a many-polygon sweep.
    // Cut one corridor at a time in integer millimetres to remove numeric noise.
    let result = subject;
    for (const cut of cuts) {
      if (!result.length) break;
      result = snapped(clipping.difference(result, cut));
    }
    return result;
  }
}
export function clipParkGround(world, track, errors = []) {
  const water = (world.water || []).flatMap((w) =>
    Array.isArray(w)
      ? [w]
      : (w.line || [])
          .slice(1)
          .map((b, i) => roadCorridor({ a: w.line[i], b, w: w.width }, 0.5))
          .filter(Boolean)
  );
  const cuts = [
    ...water,
    ...(world.areas || []),
    ...(world.buildings || []).map((b) => b.p),
    ...(world.roads || [])
      .map((r) => roadCorridor(r, r.walk ? 0.2 : 2.5))
      .filter(Boolean)
  ]
    .map((r) => [closed(r)])
    .filter((p) => p[0].length >= 4)
    .map((p) => ({ polygon: p, bounds: bounds(p[0]) }));
  const race = track ? snapped(roadFootprint(track, 1.4), SCALE) : null,
    parks = [];
  for (const [index, ring] of (world.parks || []).entries()) {
    if (ring.length < 3) continue;
    const polygon = [closed(ring)],
      box = bounds(polygon[0]);
    try {
      let result = difference(
        [polygon],
        cuts.filter((c) => intersects(box, c.bounds)).map((c) => c.polygon)
      );
      if (race) result = difference(snapped(result), [race]);
      parks.push(
        ...result.map((poly) =>
          poly.map((ring) => ring.map((p) => [p[0] / SCALE, p[1] / SCALE]))
        )
      );
    } catch (e) {
      errors.push('Park ' + index + ' clipping failed: ' + String(e));
    }
  }
  return parks;
}
