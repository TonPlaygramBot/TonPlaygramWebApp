import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { createBoard } from './fourInRowGame.js';

// Exercise the actual registered handlers without starting unrelated services.
const source = readFileSync('../bot/server.js', 'utf8');
const handlersSource = source.slice(source.indexOf("  socket.on('joinFourInRow'"), source.indexOf("  socket.on('disconnecting'"));
function setup(boardSize = '7x6') {
  const handlers = {}, fourInRowStates = new Map();
  const socket = { data: { playerId: 'alice' }, rooms: new Set(), on: (name, handler) => { handlers[name] = handler; }, emit: vi.fn(), join(id) { this.rooms.add(id); } };
  const tableMap = new Map([['test', { id: 'test', gameType: 'fourinrow', players: [{ id: 'alice' }, { id: 'bob' }], meta: { boardSize } }]]);
  const emitState = vi.fn();
  new Function('socket', 'tableMap', 'fourInRowStates', 'emitFourInRowState', handlersSource)(socket, tableMap, fourInRowStates, emitState);
  function call(name, args) { let response; handlers[name](args, (value) => { response = value; }); return response; }
  call('joinFourInRow', { tableId: 'test', accountId: 'alice' });
  return { socket, call, state: fourInRowStates.get('test'), emitState };
}
it('applies legal moves once and rejects out-of-turn, stale, invalid and impersonated moves', () => {
  const { socket, call, state } = setup();
  const move = (extra = {}) => call('fourInRowMove', { tableId: 'test', accountId: 'alice', column: 0, revision: 0, ...extra });
  expect(move({ accountId: 'bob' }).success).toBe(false);
  for (const column of [null, '0', -1, 7, 1.5]) expect(move({ column }).success).toBe(false);
  expect(move().success).toBe(true);
  expect(state.board[5][0]).toBe(0);
  expect(move().success).toBe(false);
  socket.data.playerId = 'bob';
  expect(move({ accountId: 'bob' }).error).toBe('stale_revision');
  expect(move({ accountId: 'bob', revision: 1 }).success).toBe(true);
  expect(state.board[4][0]).toBe(1);
  expect(state.revision).toBe(2);
  socket.rooms.clear();
  expect(move({ accountId: 'bob', revision: 2 }).error).toBe('not_a_table_player');
});
it.each(['8x7', '999999x999999'])('bounds table layout %s', (size) => {
  const { state } = setup(size);
  expect([state.board[0].length, state.board.length]).toEqual(size === '8x7' ? [8, 7] : [7, 6]);
});
it('finishes a vertical win and rejects moves after the result', () => {
  const { socket, call, state } = setup();
  for (const column of [0, 1, 0, 1, 0, 1, 0]) {
    socket.data.playerId = state.turn;
    expect(call('fourInRowMove', { tableId: 'test', column, revision: state.revision }).success).toBe(true);
  }
  expect(state.winner).toBe('alice');
  expect(call('fourInRowMove', { tableId: 'test', column: 2 }).success).toBe(false);
});
it('rejects a full column and restricts sync to joined players', () => {
  const { socket, call, state } = setup();
  state.board = createBoard(6, 7); state.board.forEach((row) => { row[0] = 0; });
  expect(call('fourInRowMove', { tableId: 'test', column: 0 }).error).toBe('column_full');
  socket.emit.mockClear(); socket.data.playerId = 'outsider';
  call('fourInRowSyncRequest', { tableId: 'test' });
  expect(socket.emit).not.toHaveBeenCalled();
});
