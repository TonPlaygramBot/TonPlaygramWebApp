import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createBoard } from '../../utils/fourInRowGame.js';

vi.hoisted(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
const transport = vi.hoisted(() => ({ listeners: new Map(), sent: [], connected: true, snapshot: null, moveAck: null }));
vi.mock('three', async (original) => ({ ...(await original()), WebGLRenderer: class { constructor() { throw new Error('WebGL unavailable'); } } }));
vi.mock('../../utils/socket.js', () => {
  const socket = {
    get connected() { return transport.connected; },
    on(name, cb) { transport.listeners.set(name, cb); },
    off(name, cb) { if (transport.listeners.get(name) === cb) transport.listeners.delete(name); },
    emit(name, payload, cb) {
      transport.sent.push({ name, payload });
      if (name === 'fourInRowMove') { transport.moveAck = cb; return; }
      if ((name === 'fourInRowSyncRequest' || name === 'joinFourInRow') && transport.snapshot) transport.listeners.get('fourInRowState')?.(transport.snapshot);
      cb?.({ success: true });
    },
    timeout() { return socket; }
  };
  return { socket };
});
vi.mock('../../utils/telegram.js', () => ({ getTelegramUsername: () => 'Player', getTelegramPhotoUrl: () => '' }));
vi.mock('../../hooks/useTelegramBackButton.js', () => ({ default: () => {} }));
import FourInRowRoyal from './FourInRowRoyal.jsx';

let root, container;
beforeEach(() => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  transport.listeners.clear(); transport.sent = []; transport.connected = true; transport.snapshot = null; transport.moveAck = null;
  localStorage.setItem('accountId', 'alice');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove(); vi.clearAllTimers(); vi.useRealTimers(); localStorage.clear();
});
const advance = async (ms) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const button = (col) => container.querySelector(`button[aria-label^="Drop piece in column ${col + 1}"]`);
const count = (who) => container.querySelectorAll(`[role="gridcell"][aria-label*="${who}"]`).length;
async function mount(query = '?mode=ai') {
  await act(async () => root.render(<MemoryRouter initialEntries={['/games/fourinrowroyale' + query]}><FourInRowRoyal /></MemoryRouter>));
}
async function snapshot(state) { await act(async () => transport.listeners.get('fourInRowState')(state)); }

it('stays playable without WebGL, locks rapid taps, and waits for both drops', async () => {
  await mount();
  expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(42);
  await act(async () => { button(3).click(); button(2).click(); button(3).click(); });
  expect(count('your red chip')).toBe(1);
  expect(count('rival blue chip')).toBe(0);
  expect(button(0).disabled).toBe(true);
  expect(container.textContent).toContain('Chip is dropping');
  await advance(700);
  expect(count('rival blue chip')).toBe(0);
  await advance(420);
  expect(count('rival blue chip')).toBe(1);
  expect(button(0).disabled).toBe(true);
  await advance(700);
  expect(button(0).disabled).toBe(false);
});

it('completes an AI match, shows its result after landing, and resets for a fresh round', async () => {
  await mount();
  for (let turn = 0; turn < 21 && !container.querySelector('h2'); turn++) {
    const legal = [0, 1, 6, 5, 2, 4, 3].map(button).find((node) => !node.disabled);
    expect(legal).toBeTruthy();
    await act(async () => legal.click());
    await advance(700); await advance(420); await advance(700); await advance(650);
  }
  expect(container.querySelector('h2')).toBeTruthy();
  expect(container.querySelectorAll('[aria-label*="winning chip"]')).toHaveLength(4);
  await advance(650);
  const replay = Array.from(container.querySelectorAll('button')).find((node) => node.textContent === 'Play Again');
  expect(replay).toBeTruthy();
  await act(async () => replay.click());
  expect(count('chip')).toBe(0);
  expect(container.querySelector('h2')).toBeNull();
  expect(button(3).disabled).toBe(false);
  await advance(2000);
  expect(count('chip')).toBe(0);
}, 20000);

it('restores the table layout, ignores old revisions, and reconnects the registered seat', async () => {
  transport.snapshot = { tableId: 'test', players: ['alice', 'bob'], turn: 'alice', winner: null, board: createBoard(7, 8), revision: 0 };
  await mount('?mode=online&tableId=test&accountId=alice');
  expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(56);
  expect(button(7).disabled).toBe(false);
  const next = { ...transport.snapshot, revision: 1, turn: 'bob', board: createBoard(7, 8) };
  next.board[6][7] = 0;
  await snapshot(next); await advance(700);
  expect(count('your red chip')).toBe(1);
  await snapshot(transport.snapshot);
  expect(count('your red chip')).toBe(1);
  await act(async () => { transport.connected = false; transport.listeners.get('disconnect')(); });
  expect(container.textContent).toContain('Connection lost');
  transport.snapshot = { ...next, turn: 'alice', revision: 2, board: next.board.map((row) => [...row]) };
  transport.snapshot.board[6][6] = 1;
  await act(async () => { transport.connected = true; transport.listeners.get('connect')(); });
  await advance(700);
  expect(count('rival blue chip')).toBe(1);
  expect(button(0).disabled).toBe(false);
  expect(transport.sent.filter(({ name }) => name === 'register')).toHaveLength(2);
});

it('locks pending online taps, recovers an acknowledgement timeout, and delays the result until landing', async () => {
  const board = createBoard(6, 7); board[5][0] = 0; board[5][1] = 0; board[5][2] = 0;
  transport.snapshot = { tableId: 'test', players: ['alice', 'bob'], turn: 'alice', winner: null, board, revision: 6 };
  await mount('?mode=online&tableId=test&accountId=alice');
  await act(async () => { button(3).click(); button(4).click(); });
  expect(transport.sent.filter(({ name }) => name === 'fourInRowMove')).toHaveLength(1);
  expect(button(3).disabled).toBe(true);
  await act(async () => transport.moveAck(new Error('timeout')));
  expect(button(3).disabled).toBe(false);
  const winning = { ...transport.snapshot, revision: 7, winner: 'alice', board: board.map((row) => [...row]) };
  winning.board[5][3] = 0;
  await snapshot(winning);
  expect(container.querySelector('h2')).toBeNull();
  await advance(700);
  expect(container.querySelector('h2')).toBeNull();
  await advance(650);
  expect(container.querySelector('h2').textContent).toContain('Wins!');
  expect(container.querySelectorAll('[aria-label*="winning chip"]')).toHaveLength(4);
});
