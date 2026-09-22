import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PoolCompetitionMatch } from './PoolCompetitionMatch.jsx';
import { loadPoolCompetition, poolCompetitionKey, savePoolCompetition } from './competition.js';

vi.mock('../../utils/telegram.js', () => ({ getTelegramId: () => 'test-player' }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container, gameProps;
const options = { variantKey: '9ball', tableSizeKey: '9ft', playerName: 'Alex' };
const key = poolCompetitionKey('test-player', '', '9ball');
const frame = (winner = 'A') => ({ frameOver: true, winner, players: { A: { score: 9 }, B: { score: 0 } } });
const button = (label) => [...container.querySelectorAll('button')].find((entry) => entry.textContent.includes(label));
function Game(props) { gameProps = props; return <div data-testid="game">{props.opponentName}</div>; }
const render = () => act(async () => root.render(<BrowserRouter><PoolCompetitionMatch Game={Game} options={options} /></BrowserRouter>));
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/games/poolroyale?competition=1&type=tournament&players=8');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  gameProps = null;
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

it('starts a real configured series, counts each finished rack once and passes the next round to the game', async () => {
  await render();
  await act(async () => button('Start match').click());
  expect(gameProps.competitionMatch.raceTo).toBe(2);
  expect(gameProps.competitionMatch.difficulty).toBeGreaterThan(0);
  expect(gameProps.variantKey).toBe('9ball');
  const complete = gameProps.onCompetitionFrameComplete;
  let receipt, duplicate;
  await act(async () => { receipt = complete(frame()); duplicate = complete(frame()); });
  expect(receipt).toMatchObject({ accepted: true, status: 'active', isTournament: true });
  expect(duplicate).toBeUndefined();
  expect(loadPoolCompetition(key).frames).toEqual([1, 0]);
  await act(async () => button('Play next rack').click());
  expect(gameProps.competitionMatch.frameNumber).toBe(2);
  await act(async () => gameProps.onCompetitionFrameComplete(frame()));
  expect(container.textContent).toContain('Through to the next round');
  await act(async () => button('Play next rack').click());
  expect(gameProps.competitionMatch.round).toBe(1);
  expect(gameProps.competitionMatch.frames).toEqual([0, 0]);
});

it('returns the saved frame and precise ball layout to a remounted game', async () => {
  await render();
  await act(async () => button('Start match').click());
  const savedFrame = { ...frame(), frameOver: false };
  const layout = [{ id: 'cue', pos: { x: 25, y: 41 }, active: true }];
  await act(async () => gameProps.onCompetitionCheckpoint(savedFrame, layout));
  await act(async () => root.unmount());
  root = createRoot(container);
  await render();
  expect(container.textContent).toContain('Saved rack ready to resume');
  await act(async () => button('Resume saved rack').click());
  expect(gameProps.savedFrame).toEqual({ frame: savedFrame, layout });
  expect(gameProps.tableSizeKey).toBe('9ft');
});

it('a storage failure prevents unsaved play and exposes a retry', async () => {
  await render();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  await act(async () => button('Start match').click());
  expect(gameProps).toBeNull();
  expect(container.querySelector('[role="alert"]').textContent).toContain('could not be saved');
  expect(button('Retry save')).toBeDefined();
});

it('never overwrites a newer checkpoint from a second game window', async () => {
  await render();
  await act(async () => button('Start match').click());
  const newer = loadPoolCompetition(key);
  newer.revision = 10;
  savePoolCompetition(key, newer);
  await act(async () => gameProps.onCompetitionFrameComplete(frame()));
  expect(container.querySelector('[role="alert"]').textContent).toContain('another window');
  expect(loadPoolCompetition(key).revision).toBe(10);
  expect(loadPoolCompetition(key).frames).toEqual([0, 0]);
  expect(button('Return to lobby')).toBeDefined();
});

it('keeps unsaved local shots available and recovers when storage becomes writable again', async () => {
  await render();
  await act(async () => button('Start match').click());
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
  const layout = [{ id: 'cue', pos: { x: 4, y: 7 }, active: true }];
  await act(async () => gameProps.onCompetitionCheckpoint({ ...frame(), frameOver: false }, layout));
  expect(container.querySelector('[role="alert"]').textContent).toContain('could not be saved');
  write.mockRestore();
  let receipt;
  await act(async () => { receipt = gameProps.onCompetitionFrameComplete(frame()); });
  expect(receipt?.accepted).toBe(true);
  expect(loadPoolCompetition(key).frames).toEqual([1, 0]);
  expect(container.querySelector('[role="alert"]')).toBeNull();
});
