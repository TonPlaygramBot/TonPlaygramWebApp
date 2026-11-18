/** Partition triangles by normal without changing positions or footprint. Works
 * after cell merging, so material indices never become building indices. */
export function assignBuildingSurfaceGroups(geometry) {
  const normals = geometry.getAttribute('normal');
  const source = geometry.getIndex();
  const count = source ? source.count : normals.count;
  const walls = [], caps = [];
  for (let i = 0; i < count; i += 3) {
    const triangle = [0, 1, 2].map(offset => source ? source.getX(i + offset) : i + offset);
    const target = triangle.every(vertex => Math.abs(normals.getY(vertex)) > .5) ? caps : walls;
    target.push(...triangle);
  }
  geometry.setIndex([...walls, ...caps]);
  geometry.clearGroups();
  if (walls.length) geometry.addGroup(0, walls.length, 0);
  if (caps.length) geometry.addGroup(walls.length, caps.length, 1);
  return geometry;
}
