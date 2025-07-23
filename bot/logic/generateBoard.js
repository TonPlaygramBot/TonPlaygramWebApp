import { FINAL_TILE } from './snakeGame.js';

export default function generateBoard() {
  const boardSize = FINAL_TILE - 1;
  const snakeCount = 6 + Math.floor(Math.random() * 3);
  const ladderCount = 6 + Math.floor(Math.random() * 3);
  const snakes = {};
  const used = new Set();
  while (Object.keys(snakes).length < snakeCount) {
    const start = Math.floor(Math.random() * (boardSize - 10)) + 10;
    const maxDrop = Math.min(start - 1, 20);
    if (maxDrop <= 0) continue;
    const end = start - (Math.floor(Math.random() * maxDrop) + 1);
    if (used.has(start) || used.has(end) || snakes[start] || end === 1) continue;
    snakes[start] = end;
    used.add(start);
    used.add(end);
  }
  const ladders = {};
  const usedL = new Set([...used]);
  while (Object.keys(ladders).length < ladderCount) {
    const start = Math.floor(Math.random() * (boardSize - 20)) + 2;
    const max = Math.min(boardSize - start - 1, 20);
    if (max < 1) continue;
    const end = start + (Math.floor(Math.random() * max) + 1);
    if (
      usedL.has(start) ||
      usedL.has(end) ||
      ladders[start] ||
      Object.values(ladders).includes(end)
    )
      continue;
    ladders[start] = end;
    usedL.add(start);
    usedL.add(end);
  }
  return { snakes, ladders };
}
