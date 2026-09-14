/** Incremental broad phase for deterministic authored fixture placement. */
export function pointSpacing(size = 16) {
  const cells = new Map();
  return {
    add(point) {
      const key = `${Math.floor(point.x / size)}:${Math.floor(point.z / size)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(point);
    },
    occupied(x, z, radius) {
      for (let i = Math.floor((x - radius) / size); i <= Math.floor((x + radius) / size); i++)
        for (let j = Math.floor((z - radius) / size); j <= Math.floor((z + radius) / size); j++)
          for (const point of cells.get(`${i}:${j}`) || [])
            if (Math.hypot(point.x - x, point.z - z) < radius) return true;
      return false;
    }
  };
}
