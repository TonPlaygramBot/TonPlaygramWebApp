export function generateRackPositions(
  ballCount,
  layout,
  ballRadius,
  startZ,
  anchor = null
) {
  const positions = [];
  if (
    ballCount <= 0 ||
    !Number.isFinite(ballRadius) ||
    !Number.isFinite(startZ)
  ) {
    return positions;
  }
  const diameter = ballRadius * 2;
  // Hexagonal packing: every neighbour has the same diameter plus clearance.
  const columnSpacing = diameter + ballRadius * 0.025;
  const rowSpacing = (columnSpacing * Math.sqrt(3)) / 2;
  const alignAnchorToPositions = () => {
    const anchorIndex = Number.isFinite(anchor?.index)
      ? Math.max(0, Math.floor(anchor.index))
      : -1;
    if (anchorIndex < 0 || anchorIndex >= positions.length) return positions;
    const targetX = Number.isFinite(anchor?.x)
      ? anchor.x
      : positions[anchorIndex].x;
    const targetZ = Number.isFinite(anchor?.z)
      ? anchor.z
      : positions[anchorIndex].z;
    const dx = targetX - positions[anchorIndex].x;
    const dz = targetZ - positions[anchorIndex].z;
    if (Math.abs(dx) <= 1e-8 && Math.abs(dz) <= 1e-8) return positions;
    positions.forEach((pos) => {
      pos.x += dx;
      pos.z += dz;
    });
    return positions;
  };
  if (layout === 'diamond') {
    const rows = [1, 2, 3, 2, 1];
    let index = 0;
    for (let r = 0; r < rows.length && index < ballCount; r++) {
      const count = rows[r];
      const centerOffset = (count - 1) / 2;
      for (let i = 0; i < count && index < ballCount; i++) {
        const x = (i - centerOffset) * columnSpacing;
        const z = startZ + r * rowSpacing;
        positions.push({ x, z });
        index++;
      }
    }
    return alignAnchorToPositions();
  }
  let row = 0;
  let placed = 0;
  while (placed < ballCount) {
    const count = row + 1;
    const centerOffset = row / 2;
    for (let i = 0; i < count && placed < ballCount; i++) {
      const x = (i - centerOffset) * columnSpacing;
      const z = startZ + row * rowSpacing;
      positions.push({ x, z });
      placed++;
    }
    row++;
  }
  return alignAnchorToPositions();
}

/** Map physical rack slots to ball IDs without ever moving two balls to one slot. */
export function arrangePoolRack(positions, numbers, layout = 'triangle') {
  const result = positions.map((point) => ({ ...point }));
  if (!Array.isArray(numbers)) return result;
  const swap = (a, b) => {
    if (a >= 0 && b >= 0 && a < result.length && b < result.length)
      [result[a], result[b]] = [result[b], result[a]];
  };
  // Slot 4 is the middle of both the third triangle row and the diamond.
  swap(numbers.indexOf(layout === 'diamond' ? 9 : 8), 4);
  if (
    layout !== 'diamond' &&
    numbers.every(Number.isFinite) &&
    result.length === 15
  ) {
    const leftCorner = positions[10],
      rightCorner = positions[14];
    const at = (point) =>
      result.findIndex((p) => p.x === point.x && p.z === point.z);
    const left = at(leftCorner),
      right = at(rightCorner);
    const isSolid = (index) => numbers[index] >= 1 && numbers[index] <= 7;
    if (isSolid(left) === isSolid(right)) {
      const candidate = numbers.findIndex(
        (n, index) =>
          n !== 8 &&
          index !== 0 &&
          index !== left &&
          index !== right &&
          isSolid(index) !== isSolid(left)
      );
      swap(right, candidate);
    }
  }
  return result;
}
