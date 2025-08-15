export const colorStartIndex = { red: 0, green: 13, yellow: 26, blue: 39 };
export const safeRingIndices = [0, 6, 13, 19, 26, 32, 39, 45];

export function buildLudoBoard() {
  const W = 15, H = 15;
  const board = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => ({ x, y, type: 'empty' }))
  );
  const ring = [];
  for (let x = 1; x <= 13; x++) ring.push({ x, y: 0 });
  for (let y = 1; y <= 13; y++) ring.push({ x: 14, y });
  for (let x = 13; x >= 1; x--) ring.push({ x, y: 14 });
  for (let y = 13; y >= 1; y--) ring.push({ x: 0, y });
  ring.forEach(p => (board[p.y][p.x].type = 'ring'));

  const lanes = {
    red:   [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }],
    green: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }],
    yellow:[{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }],
    blue:  [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }],
  };
  Object.entries(lanes).forEach(([c, cells]) =>
    cells.forEach(p => (board[p.y][p.x].type = `lane:${c}`))
  );
  board[7][7].type = 'home';

  const bases = {
    red:   [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
    green: [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
    yellow:[{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
    blue:  [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }],
  };
  Object.entries(bases).forEach(([c, cells]) =>
    cells.forEach(p => (board[p.y][p.x].type = `base:${c}`))
  );

  return { board, ring, lanes };
}
