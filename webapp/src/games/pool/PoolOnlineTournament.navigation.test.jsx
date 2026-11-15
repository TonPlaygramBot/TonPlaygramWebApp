import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PoolOnlineTournament from './PoolOnlineTournament.jsx';
const { socket, listeners, send } = vi.hoisted(() => {
  const listeners = new Map(), send = vi.fn();
  const socket = { connected: true, timeout: () => ({ emit: send }),
    on: (name, callback) => listeners.set(name, callback), off: name => listeners.delete(name) };
  return { socket, listeners, send };
});
vi.mock('../../utils/socket.js', () => ({ socket, refreshSocketAuthIdentity: vi.fn() }));
vi.mock('../../utils/telegram.js', () => ({ ensureAccountId: async () => 'self', getTelegramId: () => '' }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container, props, event;
const button = label => [...container.querySelectorAll('button')].find(button => button.textContent.includes(label));
const options = { variantKey: '9ball', playerName: 'You' };
function Game(value) { props = value; return <p>Actual game slot</p>; }
async function mount(query = '') {
  window.history.replaceState({}, '', `/games/poolroyale?type=tournament&mode=online${query}`);
  await act(async () => root.render(<BrowserRouter><PoolOnlineTournament Game={Game} options={options} /></BrowserRouter>));
}
beforeEach(() => {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  props = null; listeners.clear(); send.mockReset();
  event = { id: 'ABCDEF1234', host: 'self', size: 4, status: 'waiting', variant: '9ball', round: 0, totalRounds: 2,
    entrants: [{ id: 'self', name: 'You' }, { id: 'rival', name: 'Rival' }, { id: 'other1', name: 'Other' }, { id: 'other2', name: 'Another' }], draw: [] };
  send.mockImplementation((name, payload, callback) => callback(null, { success: true, event: structuredClone(event) }));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it('creates an invite room and replaces URL with the returned room code', async () => {
  await mount();
  await act(async () => button('Create tournament').click());
  expect(send).toHaveBeenCalledWith('poolTournament', expect.objectContaining({ action: 'create', accountId: 'self', variant: '9ball' }), expect.any(Function));
  expect(new URLSearchParams(window.location.search).get('tournamentId')).toBe(event.id);
  expect(container.textContent).toContain('4 / 4 players ready');
});
it('resumes the correct seat, submits the settled result, then shows the shared draw', async () => {
  event.status = 'active';
  event.draw = [[{ a: 'rival', b: 'self', tableId: 'live-1' }, { a: 'other1', b: 'other2', tableId: 'live-2' }]];
  await mount(`&tournamentId=${event.id}`);
  await act(async () => button('Play / resume').click());
  expect(props.mode).toBe('online'); expect(props.opponentName).toBe('Rival');
  expect(props.variantKey).toBe('9ball'); expect(props.tableSizeKey).toBe('9ft');
  expect(props.competitionMatch).toBeUndefined();
  expect(new URLSearchParams(window.location.search).get('seat')).toBe('B');
  await act(async () => props.onCompetitionFrameComplete({ frameOver: true, winner: 'B' }));
  expect(send).toHaveBeenCalledWith('poolTournament', expect.objectContaining({ action: 'report', tableId: 'live-1', winner: 'B' }), expect.any(Function));
  expect(container.textContent).not.toContain('Actual game slot');
  expect(new URLSearchParams(window.location.search).has('tableId')).toBe(false);
});
it('keeps a failed report reviewable and retries without losing its result', async () => {
  event.status = 'active'; event.draw = [[{ a: 'self', b: 'rival', tableId: 'live-1' }, { a: 'other1', b: 'other2', tableId: 'live-2' }]];
  await mount(`&tournamentId=${event.id}&rack=1&tableId=live-1&seat=A`);
  send.mockImplementationOnce((name, payload, callback) => callback(null, { success: false, error: 'Result delayed' }));
  await act(async () => props.onCompetitionFrameComplete({ frameOver: true, winner: 'A' }));
  expect(container.querySelector('[role=alert]').textContent).toContain('Result delayed');
  expect(container.textContent).toContain('Actual game slot');
  await act(async () => button('Retry result').click());
  expect(container.textContent).not.toContain('Actual game slot');
});
it('requires an explicit second click to concede a match', async () => {
  event.status = 'active'; event.draw = [[{ a: 'self', b: 'rival', tableId: 'live-1' }, { a: 'other1', b: 'other2', tableId: 'live-2' }]];
  await mount(`&tournamentId=${event.id}`);
  await act(async () => button('Concede match').click());
  expect(send.mock.calls.some(([, payload]) => payload.action === 'forfeit')).toBe(false);
  await act(async () => button('Confirm concede').click());
  expect(send.mock.calls.some(([, payload]) => payload.action === 'forfeit')).toBe(true);
});
