/** Static placements are indexed once. Moving the camera visits local cells,
 * rather than allocating a distance record for every building in the region. */
export class VisibilityIndex {
  cells = new Map();
  constructor(items, cellSize = 240) {
    this.cellSize = cellSize;
    for (const item of items) {
      const key = `${Math.floor(item.x / cellSize)}:${Math.floor(item.z / cellSize)}`;
      if (!this.cells.has(key)) this.cells.set(key, []);
      this.cells.get(key).push(item);
    }
  }
  query(target, radius, accepts = () => true) {
    if (!Number.isFinite(target?.x) || !Number.isFinite(target?.z)) return [];
    const candidates = [], size = this.cellSize, radiusSq = radius * radius;
    for (let x = Math.floor((target.x - radius) / size); x <= Math.floor((target.x + radius) / size); x++) {
      for (let z = Math.floor((target.z - radius) / size); z <= Math.floor((target.z + radius) / size); z++) {
        for (const item of this.cells.get(`${x}:${z}`) || []) {
          const distanceSq = (item.x - target.x) ** 2 + (item.z - target.z) ** 2;
          if (distanceSq <= radiusSq && accepts(item)) candidates.push({item, distanceSq});
        }
      }
    }
    return candidates.sort((a, b) => a.distanceSq - b.distanceSq);
  }
}

/** Reserve a few existing slots for each distance band, so dense nearby blocks
 * cannot consume the entire distant-detail allowance. Unused slots stay useful. */
export function selectVisibilityBands(candidates, bands) {
  const selected = new Set();
  let previous = -1, limit = 0;
  for (const {radius, count} of bands) {
    const radiusSq = radius * radius;
    let used = 0;
    limit += count;
    for (const candidate of candidates) {
      if (candidate.distanceSq > radiusSq) break;
      if (candidate.distanceSq <= previous || used >= count) continue;
      selected.add(candidate);
      used++;
    }
    previous = radiusSq;
  }
  for (const candidate of candidates) {
    if (selected.size >= limit || candidate.distanceSq > previous) break;
    selected.add(candidate);
  }
  return [...selected].sort((a, b) => a.distanceSq - b.distanceSq);
}
