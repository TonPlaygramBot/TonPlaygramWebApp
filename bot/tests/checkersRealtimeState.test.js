import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCheckersRealtimeStore,
  createInitialCheckersBoard
} from '../utils/checkersRealtimeState.js';

test('createInitialCheckersBoard creates a standard 12 vs 12 setup', () => {
  const board = createInitialCheckersBoard();
  let light = 0;
  let dark = 0;
  board.forEach((row) =>
    row.forEach((cell) => {
      if (cell?.side === 'light') light += 1;
      if (cell?.side === 'dark') dark += 1;
    })
  );
  assert.equal(light, 12);
  assert.equal(dark, 12);
});

test('store returns default state and accepts valid updates', () => {
  const store = createCheckersRealtimeStore();
  const initial = store.getState('table-1');
  assert.equal(initial.turn, 'light');
  assert.equal(initial.board.length, 8);

  const nextBoard = createInitialCheckersBoard();
  nextBoard[5][0] = null;
  nextBoard[4][1] = { side: 'light', king: false };
  const next = store.updateState('table-1', {
    board: nextBoard,
    turn: 'dark',
    lastMove: { from: { r: 5, c: 0 }, to: { r: 4, c: 1 } }
  });

  assert.equal(next.turn, 'dark');
  assert.equal(next.board[4][1]?.side, 'light');
  assert.deepEqual(next.lastMove?.to, { r: 4, c: 1 });
});

test('store ignores malformed board payloads', () => {
  const store = createCheckersRealtimeStore();
  const before = store.getState('table-2');
  const after = store.updateState('table-2', {
    board: { broken: true },
    turn: 'oops'
  });
  assert.deepEqual(after.board, before.board);
  assert.equal(after.turn, before.turn);
});
