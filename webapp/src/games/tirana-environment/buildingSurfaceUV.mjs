/** Metric UVs for the mapped building shells, without modifying their geometry.
 * Walls use the face tangent and elevation; roofs keep the ground-plane mapping.
 * Projecting every surface onto x/z collapses vertical walls into a single row.
 */
export function buildingSurfaceUV(x, y, z, nx, ny, nz, metresPerTile = 4) {
  if (!Number.isFinite(metresPerTile) || metresPerTile <= 0) {
    throw new RangeError('metresPerTile must be positive and finite');
  }
  if (Math.abs(ny) > .5) return [x / metresPerTile, z / metresPerTile];
  const horizontalLength = Math.hypot(nx, nz);
  if (horizontalLength < 1e-8) return [x / metresPerTile, y / metresPerTile];
  return [(-nz * x + nx * z) / horizontalLength / metresPerTile, y / metresPerTile];
}
