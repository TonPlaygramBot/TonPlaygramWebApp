import clipping from 'polygon-clipping';

export const RACE_ROAD_WIDTH = 24;
export const TIRE_RADIUS = 0.34;
export const CURB_WIDTH = 0.36;
const cache = new WeakMap();
const cityCache = new WeakMap();
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export function roadCorners(track) {
  const all = track.points.map((p) => [p.x, p.z]);
  return all.filter((p, i) => {
    const a = all[(i + all.length - 1) % all.length],
      b = all[(i + 1) % all.length];
    return (
      Math.abs((p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])) >
      1e-6
    );
  });
}

// Union the same segment-distance corridor used by collision detection. Round
// outside joins and intersecting inside joins remain closed at acute street turns.
export function roadFootprint(track, extra = 0) {
  let entries = cache.get(track);
  if (!entries) cache.set(track, (entries = new Map()));
  if (entries.has(extra)) return entries.get(extra);
  const radius = track.width / 2 + extra,
    corners = roadCorners(track),
    pieces = [];
  if (!(radius > 0) || corners.length < 3) throw Error('Invalid racing road');
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i],
      b = corners[(i + 1) % corners.length],
      length = distance(a, b);
    const nx = (-(b[1] - a[1]) / length) * radius,
      nz = ((b[0] - a[0]) / length) * radius;
    pieces.push([
      [
        [a[0] + nx, a[1] + nz],
        [b[0] + nx, b[1] + nz],
        [b[0] - nx, b[1] - nz],
        [a[0] - nx, a[1] - nz],
        [a[0] + nx, a[1] + nz]
      ]
    ]);
    const circle = Array.from({ length: 65 }, (_, j) => [
      a[0] + Math.cos((j / 64) * Math.PI * 2) * radius,
      a[1] + Math.sin((j / 64) * Math.PI * 2) * radius
    ]);
    circle[64] = circle[0];
    pieces.push([circle]);
  }
  const result = clipping.union(...pieces);
  entries.set(extra, result);
  return result;
}

export function centerlineDistance(track, x, z) {
  let best = Infinity;
  for (let i = 0; i < track.points.length; i++) {
    const a = track.points[i],
      b = track.points[(i + 1) % track.points.length];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1))
    );
    best = Math.min(best, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
  }
  return best;
}

// The curb is the exact difference between two joined corridors. This also
// clips concave inner corners, where independent offset boxes overlap asphalt.
export function roadCurbFootprint(track) {
  return clipping.difference(
    roadFootprint(track, CURB_WIDTH),
    roadFootprint(track)
  );
}

// Keep the recorded city coordinates. Trim only facade footprints that intrude
// into the widened race corridor, including the outer face of the tire barrier.
export function raceCityBuildings(track, buildings) {
  let entries = cityCache.get(track);
  if (!entries) cityCache.set(track, (entries = new WeakMap()));
  if (entries.has(buildings)) return entries.get(buildings);
  const corridor = roadFootprint(track, 1.3);
  const result = buildings.flatMap((building) =>
    clipping
      .difference([building.p], corridor)
      .filter((p) => p.length === 1)
      .map((p) => ({ ...building, p: p[0].slice(0, -1) }))
  );
  entries.set(buildings, result);
  return result;
}

/** Each real inside/outside boundary owns its spacing and closing seam. A spatial
 * check handles sharp concave joins, where arc spacing alone allows tire overlap. */
export function racingTireLayout(track) {
  const tires = [],
    cells = new Map(),
    diameter = TIRE_RADIUS * 2;
  let row = 0;
  for (const polygon of roadFootprint(track, 0.86))
    for (const ring of polygon) {
      const lengths = ring.slice(1).map((p, i) => distance(ring[i], p));
      const perimeter = lengths.reduce((a, b) => a + b, 0);
      const count = Math.max(3, Math.floor(perimeter / 0.76)),
        spacing = perimeter / count;
      let segment = 0,
        passed = 0;
      for (let i = 0; i < count; i++) {
        const at = (i + 0.5) * spacing;
        while (segment < lengths.length - 1 && passed + lengths[segment] < at)
          passed += lengths[segment++];
        const a = ring[segment],
          b = ring[segment + 1],
          u = (at - passed) / lengths[segment];
        const x = a[0] + (b[0] - a[0]) * u,
          z = a[1] + (b[1] - a[1]) * u;
        const cx = Math.floor(x / diameter),
          cz = Math.floor(z / diameter);
        let overlaps = false;
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++)
            for (const other of cells.get(`${cx + dx}:${cz + dz}`) || [])
              if (Math.hypot(x - other.x, z - other.z) < diameter + 0.015)
                overlaps = true;
        if (overlaps) continue;
        const item = {
          x,
          z,
          yaw: Math.atan2(b[0] - a[0], b[1] - a[1]),
          row,
          seed: i,
          distance: at,
          spacing,
          perimeter
        };
        const key = `${cx}:${cz}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(item);
        tires.push(item);
      }
      row++;
    }
  return tires;
}
