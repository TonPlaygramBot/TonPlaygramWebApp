import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import SnakeAndLadder from './SnakeAndLadder';
import { SNAKE_DICE_READ_MS } from '../../utils/snakeDiceInteraction';
import { LUDO_DICE_PRESENTATION_MS, LUDO_DICE_TIMING } from '../../utils/ludoDiceMotion';
import { setGameMuted } from '../../utils/sound.js';
import { SNAKE_FINAL_TILE as FINAL_TILE } from '../../../../lib/snakeRules.js';

const testState = vi.hoisted(() => ({ handlers: new Map(), events: [], board: null, deposits: [], boardPositions: [] }));
vi.mock('../../utils/socket.js', () => ({ socket: {
  on: (name, handler) => { if (!testState.handlers.has(name)) testState.handlers.set(name, new Set()); testState.handlers.get(name).add(handler); },
  off: (name, handler) => testState.handlers.get(name)?.delete(handler),
  emit: (...args) => testState.events.push(args), io: { on() {}, off() {} }
} }));
vi.mock('../../utils/telegram.js', () => ({ getPlayerId: () => 'p1', getTelegramId: () => null, ensureAccountId: async () => 'p1' }));
vi.mock('../../utils/api.js', async (original) => ({ ...(await original()),
  getProfileByAccount: async () => ({}), pingOnline: async () => ({}), unseatTable: async () => ({}),
  depositAccount: async (...args) => { testState.deposits.push(args); return {}; },
  addTransaction: async () => ({}),
  getSnakeBoard: async () => ({ snakes: { 9: 2 }, ladders: { 3: 8 }, diceCells: {} })
}));
vi.mock('../../components/SnakeBoard3D.jsx', () => ({ default: (props) => {
  testState.board = props;
  testState.boardPositions.push(props.players.map(player => player.position));
  React.useEffect(() => { if (props.slide) props.onSlideComplete(props.slide.id); }, [props.slide]);
  return <div data-testid="board" />;
} }));
vi.mock('../../utils/coinConfetti', () => ({ default() {} }));
vi.mock('../../components/GiftPopup.jsx', () => ({ default: () => null }));
vi.mock('../../components/QuickMessagePopup.jsx', () => ({ default: () => null }));
vi.mock('../../components/PlayerPopup.jsx', () => ({ default: () => null }));
vi.mock('../../components/HintPopup.jsx', () => ({ default: () => null }));

let root, host;
async function emit(name, payload) { await act(async () => { for (const handler of testState.handlers.get(name) || []) handler(payload); }); }
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('Audio', class { volume = 1; currentTime = 0; play() { return Promise.resolve(); } pause() {} addEventListener() {} removeEventListener() {} });
  localStorage.clear(); testState.handlers.clear(); testState.events = [];
  testState.deposits = []; testState.boardPositions = [];
  setGameMuted(false);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('keeps local rolling locked until the die lands and the entry hop finishes', async () => {
  window.history.replaceState({}, '', '/games/snake?ai=1');
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = 5; return array; });
  const roll = () => host.querySelector('.snake-roll-button');
  expect(roll().disabled).toBe(false);
  await act(async () => { roll().click(); roll().click(); });
  expect(roll().disabled).toBe(true);
  expect(testState.board.diceEvent.values).toEqual([6]);
  expect(testState.board.diceEvent.receiverSeatIndex).toBe(0);
  await act(async () => vi.advanceTimersByTimeAsync(LUDO_DICE_TIMING.release));
  expect(testState.board.players[0].position).toBe(0);
  expect(testState.board.diceEvent.phase).toBe('start');
  await act(async () => vi.advanceTimersByTimeAsync(LUDO_DICE_PRESENTATION_MS - LUDO_DICE_TIMING.release));
  expect(roll().disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(SNAKE_DICE_READ_MS));
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
  await emit('diceRolled', {playerId:'p1',dice:[2],value:2,nextPlayerId:'p2'});
  expect(testState.board.players.map(p => p.seatIndex).sort()).toEqual([0, 1]);
  expect(testState.board.diceEvent.receiverSeatIndex).toBe(testState.board.players[1].seatIndex);
  await emit('movePlayer', {playerId:'p1',from:1,to:3});
  await emit('snakeOrLadder', {playerId:'p1',from:3,to:8});
  await emit('turnChanged', {playerId:'p2'});
  await emit('snakeState', {...state,currentPlayerId:'p2',players:[{...state.players[0],position:8},state.players[1]]});
  expect(testState.board.players[0].position).toBe(1);
  expect(host.querySelector('.snake-roll-button').disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(LUDO_DICE_PRESENTATION_MS + SNAKE_DICE_READ_MS));
  for (let step=0;step<5;step++) await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(testState.board.players[0].position).toBe(8);
  expect(testState.board.currentTurn).toBe(1);
  expect(host.querySelector('.snake-roll-button').disabled).toBe(true);
});

it('keeps the human turn after an overshooting six at tile 49', async () => {
  window.history.replaceState({}, '', '/games/snake?ai=1');
  localStorage.setItem('snakeGameState_0', JSON.stringify({ pos: 49, aiPositions: [], currentTurn: 0 }));
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  expect(testState.board.players[0].position).toBe(49);
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = 5; return array; });
  await act(async () => host.querySelector('.snake-roll-button').click());
  await act(async () => vi.advanceTimersByTimeAsync(LUDO_DICE_PRESENTATION_MS + SNAKE_DICE_READ_MS + 500));
  expect(testState.board.players[0].position).toBe(49);
  expect(testState.board.currentTurn).toBe(0);
  expect(host.querySelector('.snake-roll-button').disabled).toBe(false);
  vi.restoreAllMocks();
});

it('gives the AI the same extra turn after an overshooting six at tile 49', async () => {
  window.history.replaceState({}, '', '/games/snake?ai=1');
  localStorage.setItem('snakeGameState_0', JSON.stringify({ pos: 0, aiPositions: [49], currentTurn: 0 }));
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  expect(testState.board.players[1].position).toBe(49);
  const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = 0; return array; });
  await act(async () => host.querySelector('.snake-roll-button').click());
  await act(async () => vi.advanceTimersByTimeAsync(LUDO_DICE_PRESENTATION_MS + SNAKE_DICE_READ_MS + 500));
  random.mockImplementation(array => { array[0] = 5; return array; });
  for (let tick = 0; tick < 100 && testState.board.diceEvent?.seatIndex !== 1; tick += 1) {
    await act(async () => vi.advanceTimersByTimeAsync(100));
  }
  expect(testState.board.diceEvent.seatIndex).toBe(1);
  expect(testState.board.diceEvent.values).toEqual([6]);
  await act(async () => vi.advanceTimersByTimeAsync(LUDO_DICE_PRESENTATION_MS + SNAKE_DICE_READ_MS + 500));
  expect(testState.board.players[1].position).toBe(49);
  expect(testState.board.currentTurn).toBe(1);
  vi.restoreAllMocks();
});

async function mountPractice() {
  window.history.replaceState({}, '', '/games/snake?ai=1');
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
}
function buttonWithLabel(label) {
  return document.querySelector(`button[aria-label="${label}"]`);
}
function buttonWithText(text, container = document) {
  return [...container.querySelectorAll('button')].find(button => button.textContent === text);
}

it('opens the real rules dialog from the Ludo-style menu and closes it without leaving', async () => {
  await mountPractice();
  await act(async () => buttonWithLabel('Open game settings menu').click());
  await act(async () => buttonWithLabel('How to play').click());
  const rules = document.querySelector('[role="dialog"]');
  expect(rules.textContent).toContain(`Be the first to reach tile ${FINAL_TILE}.`);
  expect(rules.textContent).toContain('Enter with a six.');
  expect(rules.textContent).toContain('Capture a rival.');
  expect(rules.textContent).toContain('Finish exactly.');
  await act(async () => buttonWithText('Close', rules).click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(window.location.pathname).toBe('/games/snake');
  expect(host.querySelector('.snake-roll-button').disabled).toBe(false);
});

it('switches between player and board view using the production camera props', async () => {
  await mountPractice();
  expect(testState.board.cameraViewMode).toBe('3d');
  await act(async () => buttonWithLabel('Switch to board view').click());
  expect(testState.board.cameraViewMode).toBe('2d');
  expect(buttonWithLabel('Switch to player view').getAttribute('aria-pressed')).toBe('true');
  await act(async () => buttonWithLabel('Switch to player view').click());
  expect(testState.board.cameraViewMode).toBe('3d');
  expect(buttonWithLabel('Switch to board view').getAttribute('aria-pressed')).toBe('false');
});

it('keeps dock mute controls, stored audio settings and the arena sound state in sync', async () => {
  await mountPractice();
  expect(testState.board.soundEnabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(5100));
  const secondsLeft = Number(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'));
  expect(secondsLeft).toBeLessThanOrEqual(10);
  await act(async () => buttonWithLabel('Mute game audio').click());
  expect(localStorage.getItem('gameMuted')).toBe('true');
  expect(testState.board.soundEnabled).toBe(false);
  expect(buttonWithLabel('Unmute game audio').getAttribute('aria-pressed')).toBe('true');
  expect(Number(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'))).toBe(secondsLeft);
  await act(async () => setGameMuted(false));
  expect(testState.board.soundEnabled).toBe(true);
  expect(buttonWithLabel('Mute game audio').getAttribute('aria-pressed')).toBe('false');
  expect(Number(host.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'))).toBe(secondsLeft);
});

it('closes settings with Escape or Close and restores focus to its opening control', async () => {
  await mountPractice();
  const open = buttonWithLabel('Open game settings menu');
  open.focus();
  await act(async () => open.click());
  let settings = document.querySelector('[role="dialog"]');
  expect(settings.textContent).toContain('Table Setup');
  expect(settings.textContent).toContain('Graphics');
  expect(document.activeElement.textContent).toBe('Close');
  await act(async () => settings.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(open);
  await act(async () => open.click());
  settings = document.querySelector('[role="dialog"]');
  await act(async () => buttonWithText('Close', settings).click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(open);
});

it('keeps the current match and saved progress when the player cancels leaving', async () => {
  await mountPractice();
  const state = localStorage.getItem('snakeGameState_0');
  const positions = testState.board.players.map(player => player.position);
  await act(async () => buttonWithLabel('Open game settings menu').click());
  await act(async () => buttonWithText('Return to lobby').click());
  expect(buttonWithText('Keep playing')).toBeDefined();
  await act(async () => buttonWithText('Keep playing').click());
  expect(buttonWithText('Keep playing')).toBeUndefined();
  expect(window.location.pathname + window.location.search).toBe('/games/snake?ai=1');
  expect(localStorage.getItem('snakeGameState_0')).toBe(state);
  expect(testState.board.players.map(player => player.position)).toEqual(positions);
  expect(host.querySelector('.snake-roll-button').disabled).toBe(false);
});

it('updates the seated player positions, active player and connection status from online snapshots', async () => {
  window.history.replaceState({}, '', '/games/snake?table=snake-2&capacity=2');
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  await emit('snakeState', {
    roomId: 'snake-2', status: 'playing', currentPlayerId: 'p2', maxPlayers: 2,
    snakes: { 9: 2 }, ladders: { 3: 8 }, diceCells: {},
    players: [{ playerId: 'p1', name: 'Ada', position: 12 }, { playerId: 'p2', name: 'Arben', position: 24 }]
  });
  let cards = [...host.querySelectorAll('[data-seat-index]')];
  expect(host.querySelector('[data-player-detail]')).toBeNull(); // Match Ludo's uncluttered avatar presentation.
  expect(cards[0].getAttribute('aria-label')).toContain(`Ada (you), tile 12 of ${FINAL_TILE}`);
  expect(cards[1].getAttribute('aria-label')).toContain(`Arben, tile 24 of ${FINAL_TILE}, current turn`);
  expect(cards[0].hasAttribute('aria-current')).toBe(false);
  expect(cards[1].getAttribute('aria-current')).toBe('true');
  expect(host.querySelector('.snake-roll-button').disabled).toBe(true);
  await emit('playerDisconnected', { playerId: 'p2', maxPlayers: 2 });
  cards = [...host.querySelectorAll('[data-seat-index]')];
  expect(cards[1].getAttribute('aria-label')).toContain('reconnecting');
  await emit('playerRejoined', { playerId: 'p2', maxPlayers: 2 });
  expect(host.querySelectorAll('[data-seat-index]')[1].getAttribute('aria-label')).toContain('tile 24');
  expect(host.querySelectorAll('[data-seat-index]')[1].getAttribute('aria-label')).not.toContain('reconnecting');
});

it('keeps the local live-video photo and gift targets attached to the correct online seats', async () => {
  window.history.replaceState({}, '', '/games/snake?table=snake-2&capacity=2');
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  await emit('snakeState', {
    roomId: 'snake-2', status: 'playing', currentPlayerId: 'p1', maxPlayers: 2,
    snakes: {}, ladders: {}, diceCells: {},
    players: [{ playerId: 'p2', name: 'Arben', position: 4 }, { playerId: 'p1', name: 'Ada', position: 7 }]
  });
  const localAvatar = host.querySelector('[data-self-player="true"]');
  expect(localAvatar.tagName).toBe('IMG');
  expect(localAvatar.alt).toBe('Your avatar');
  expect(localAvatar.closest('[data-player-index]').getAttribute('data-player-index')).toBe('1');
  expect(host.querySelector('[data-player-index="0"]').textContent).toContain('Arben');
  const localSeat = host.querySelector('[data-player-index="1"]').closest('[data-seat-index]');
  expect(localSeat.textContent).toContain('You');
  expect(localSeat.getAttribute('data-seat-index')).toBe('0');
  expect(localSeat.style.left).toBe('50%');
  expect(localSeat.style.top).toBe('86%');
  await act(async () => testState.board.onSeatPositionsChange([{ index: 1, x: 64, y: 38, depth: 3 }]));
  const opponentSeat = host.querySelector('[data-player-index="0"]').closest('[data-seat-index]');
  expect(opponentSeat.style.left).toContain('64%');
  expect(opponentSeat.style.top).toContain('38%');
  expect(host.querySelectorAll('[data-self-player="true"]')).toHaveLength(1);
});

it('finishes exactly once on the real 3D pot at tile 50 after rolling one from tile 49', async () => {
  window.history.replaceState({}, '', '/games/snake?ai=1');
  localStorage.setItem('snakeGameState_0', JSON.stringify({ pos: 49, aiPositions: [], currentTurn: 0 }));
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  expect(FINAL_TILE).toBe(50);
  expect(testState.board.players[0].position).toBe(49);
  vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => { array[0] = 0; return array; });
  await act(async () => host.querySelector('.snake-roll-button').click());
  expect(testState.board.diceEvent.values).toEqual([1]);
  await act(async () => vi.advanceTimersByTimeAsync(LUDO_DICE_PRESENTATION_MS + SNAKE_DICE_READ_MS + 500));
  // Flush the token landing callback, then its 80ms movement completion delay.
  await act(async () => vi.advanceTimersByTimeAsync(100));
  expect(testState.board.players[0].position).toBe(50);
  expect(host.querySelector('[data-seat-index]').getAttribute('aria-label')).toContain('finished');
  expect(host.querySelector('.snake-roll-button')).toBeNull();
  expect(buttonWithText('Return to Lobby')).toBeDefined();
  expect(testState.deposits.filter(([, , options]) => options?.game === 'snake-win')).toHaveLength(1);
  await act(async () => vi.advanceTimersByTimeAsync(20000));
  expect(testState.board.players[0].position).toBe(50);
  expect(testState.deposits.filter(([, , options]) => options?.game === 'snake-win')).toHaveLength(1);
  expect(testState.boardPositions.flat().every(position => position <= 50)).toBe(true);
});

it('keeps rolling locked after dismissing a connection warning until an authoritative state restores play', async () => {
  window.history.replaceState({}, '', '/games/snake?table=snake-2&capacity=2');
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  const joiningNotice = document.querySelector('[role="dialog"]');
  if (joiningNotice) await act(async () => buttonWithText('Close', joiningNotice).click());
  const state = {
    roomId: 'snake-2', status: 'playing', currentPlayerId: 'p1', maxPlayers: 2,
    snakes: {}, ladders: {}, diceCells: {},
    players: [{ playerId: 'p1', name: 'Ada', position: 12 }, { playerId: 'p2', name: 'Arben', position: 24 }]
  };
  await emit('snakeState', state);
  expect(host.querySelector('.snake-roll-button').disabled).toBe(false);
  await emit('disconnect');
  const warning = document.querySelector('[role="dialog"]');
  expect(warning.textContent).toContain('Connection Lost');
  expect(host.querySelector('.snake-roll-button').disabled).toBe(true);
  await act(async () => buttonWithText('Close', warning).click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('.snake-roll-button').disabled).toBe(true);
  const rollsSent = () => testState.events.filter(([event]) => event === 'rollDice').length;
  expect(rollsSent()).toBe(0);
  await act(async () => host.querySelector('.snake-roll-button').click());
  expect(rollsSent()).toBe(0);
  await emit('snakeState', state);
  expect(host.querySelector('.snake-roll-button').disabled).toBe(false);
});

it('restores a legacy save already at the pot as finished without replaying turns or paying again', async () => {
  window.history.replaceState({}, '', '/games/snake?ai=1');
  localStorage.setItem('snakeGameState_0', JSON.stringify({
    pos: 50, aiPositions: [0], currentTurn: 1, gameOver: false, timestamp: Date.now() - 1
  }));
  await act(async () => root.render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>));
  expect(testState.board.players.map(player => player.position)).toEqual([50, 0]);
  expect(host.querySelector('[data-seat-index]').getAttribute('aria-label')).toContain('finished');
  expect(host.querySelector('.snake-roll-button')).toBeNull();
  const results = buttonWithText('Return to Lobby').parentElement;
  expect(results.textContent).toContain('Winner');
  const winnerImage = results.querySelector('img');
  expect(winnerImage.alt).toBe('You');
  expect(winnerImage.nextElementSibling.textContent).toBe('0');
  expect(testState.deposits).toHaveLength(0);
  await act(async () => vi.advanceTimersByTimeAsync(20000));
  expect(testState.board.players.map(player => player.position)).toEqual([50, 0]);
  expect(testState.board.diceEvent).toBeNull();
  expect(host.querySelector('.snake-roll-button')).toBeNull();
  expect(testState.deposits).toHaveLength(0);
});


it('centers the Ludo-style camera without restarting or changing Snake progress', async () => {
  await mountPractice();
  const positions = testState.board.players.map(player => player.position);
  const resetKey = testState.board.cameraResetKey;
  await act(async () => buttonWithLabel('Open game settings menu').click());
  expect(document.querySelector('[role="dialog"]').textContent).toContain('Personalize Arena');
  await act(async () => buttonWithText('Center camera').click());
  expect(testState.board.cameraResetKey).toBe(resetKey + 1);
  expect(testState.board.players.map(player => player.position)).toEqual(positions);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(testState.board.cameraViewMode).toBe('3d');
  expect(host.querySelector('.snake-roll-button').disabled).toBe(false);
});


it('uses the Ludo sound checkbox semantics while preserving the Snake match', async () => {
  await mountPractice();
  const positions=testState.board.players.map(player => player.position);
  await act(async () => buttonWithLabel('Open game settings menu').click());
  const label=[...host.querySelectorAll('label')].find(node=>node.textContent.includes('Sound effects'));
  const sound=label.querySelector('input');
  expect(sound.checked).toBe(true);
  await act(async()=>sound.click());
  expect(testState.board.soundEnabled).toBe(false);
  expect(localStorage.getItem('gameMuted')).toBe('true');
  await act(async()=>sound.click());
  expect(testState.board.soundEnabled).toBe(true);
  expect(testState.board.players.map(player => player.position)).toEqual(positions);
});
