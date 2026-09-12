import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import SnakeAndLadder from './SnakeAndLadder';

const testState = vi.hoisted(() => ({ handlers: new Map(), events: [], board: null }));
vi.mock('../../utils/socket.js', () => ({ socket: {
  on: (name, handler) => { if (!testState.handlers.has(name)) testState.handlers.set(name, new Set()); testState.handlers.get(name).add(handler); },
  off: (name, handler) => testState.handlers.get(name)?.delete(handler),
  emit: (...args) => testState.events.push(args), io: { on() {}, off() {} }
} }));
vi.mock('../../utils/telegram.js', () => ({ getPlayerId: () => 'p1', getTelegramId: () => null, ensureAccountId: async () => 'p1' }));
vi.mock('../../utils/api.js', async (original) => ({ ...(await original()),
  getProfileByAccount: async () => ({}), pingOnline: async () => ({}), unseatTable: async () => ({}),
  getSnakeBoard: async () => ({ snakes: { 9: 2 }, ladders: { 3: 8 }, diceCells: {} })
}));
vi.mock('../../components/SnakeBoard3D.jsx', () => ({ default: (props) => {
  testState.board = props;
  React.useEffect(() => { if (props.slide) props.onSlideComplete(props.slide.id); }, [props.slide]);
  return <div data-testid="board" />;
} }));
vi.mock('../../utils/coinConfetti', () => ({ default() {} }));
vi.mock('../../components/BottomLeftIcons.jsx', () => ({ default: () => null }));
vi.mock('../../components/AvatarTimer.jsx', () => ({ default: () => null }));
vi.mock('../../components/GiftPopup.jsx', () => ({ default: () => null }));
vi.mock('../../components/QuickMessagePopup.jsx', () => ({ default: () => null }));
vi.mock('../../components/PlayerPopup.jsx', () => ({ default: () => null }));
vi.mock('../../components/InfoPopup.jsx', () => ({ default: () => null }));
vi.mock('../../components/HintPopup.jsx', () => ({ default: () => null }));

let root, host;
async function emit(name, payload) { await act(async () => { for (const handler of testState.handlers.get(name) || []) handler(payload); }); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Audio', class { volume = 1; currentTime = 0; play() { return Promise.resolve(); } pause() {} addEventListener() {} removeEventListener() {} });
  localStorage.clear(); testState.handlers.clear(); testState.events = [];
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals(); });

it('keeps local rolling locked until the die lands and the entry hop finishes', async () => {
  window.history.replaceState({}, '', '/games/snake?ai=1');
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = 5; return array; });
  const roll = () => host.querySelector('.snake-roll-button');
  expect(roll().disabled).toBe(false);
  await act(async () => { roll().click(); roll().click(); });
  expect(roll().disabled).toBe(true);
  expect(testState.board.diceEvent.values).toEqual([6]);
  await act(async () => vi.advanceTimersByTimeAsync(980));
  expect(roll().disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(320));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(testState.board.players[0].position).toBe(1);
  expect(roll().disabled).toBe(false);
  vi.restoreAllMocks();
});

it('animates a server roll and ladder before applying the final snapshot', async () => {
  window.history.replaceState({}, '', '/games/snake?table=snake-2&capacity=2');
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  const state = { roomId: 'snake-2', status: 'playing', currentPlayerId: 'p1', maxPlayers: 2,
    snakes: {9:2}, ladders: {3:8}, diceCells: {}, players: [{playerId:'p1',name:'You',position:1},{playerId:'p2',name:'Opponent',position:0}] };
  await emit('snakeState', state);
  await emit('diceRolled', {playerId:'p1',dice:[2],value:2});
  await emit('movePlayer', {playerId:'p1',from:1,to:3});
  await emit('snakeOrLadder', {playerId:'p1',from:3,to:8});
  await emit('turnChanged', {playerId:'p2'});
  await emit('snakeState', {...state,currentPlayerId:'p2',players:[{...state.players[0],position:8},state.players[1]]});
  expect(testState.board.players[0].position).toBe(1);
  expect(host.querySelector('.snake-roll-button').disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(1300));
  for (let step=0;step<5;step++) await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(testState.board.players[0].position).toBe(8);
  expect(testState.board.currentTurn).toBe(1);
  expect(host.querySelector('.snake-roll-button').disabled).toBe(true);
});
