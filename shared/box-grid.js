export function createBoxGrid(width, height, init = () => ({})) {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({ x, y, ...init(x, y) }))
  );
}

export function forEachCell(grid, fn) {
  for (const row of grid) {
    for (const cell of row) fn(cell);
  }
}
