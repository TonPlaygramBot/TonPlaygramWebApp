import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SocialCallController from './SocialCallController.jsx';
import { listLocalCalls } from '../utils/socialHubState.js';

const state = vi.hoisted(() => ({ handlers: new Map(), emit: vi.fn(), ack: null }));
vi.mock('../utils/socket.js', () => ({ socket: {
  on: (name, callback) => state.handlers.set(name, callback),
  off: (name) => state.handlers.delete(name),
  emit: state.emit,
  timeout: () => ({ emit: (name, payload, callback) => { state.emit(name, payload); state.ack = callback; } })
} }));
vi.mock('../utils/telegram.js', () => ({ getPlayerId: () => 'self' }));
vi.mock('./FriendCallOverlay.jsx', () => ({ default: ({ call, onEnd }) => call ? <button onClick={onEnd}>End active call</button> : null }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
const incoming = { roomId: 'friend-call-one', fromAccountId: 'peer', toAccountId: 'self', fromName: 'Arta', type: 'voice' };
beforeEach(async () => {
  localStorage.clear(); state.handlers.clear(); state.emit.mockClear(); state.ack = null;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<SocialCallController />));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async (label) => act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === label).click());
it('waits for server acceptance before opening media and tracks only local call metadata', async () => {
  await act(async () => state.handlers.get('friendCall:incoming')(incoming));
  await click('Accept');
  expect(host.textContent).not.toContain('End active call');
  await act(async () => state.ack(null, { success: true }));
  expect(host.textContent).toContain('End active call');
  expect(listLocalCalls('self')[0].status).toBe('connected');
  await click('End active call');
  expect(state.emit).toHaveBeenCalledWith('friendCall:end', expect.objectContaining(incoming));
  expect(host.textContent).not.toContain('End active call');
});
it('does not reopen a call if it ends while the accept request is pending', async () => {
  await act(async () => state.handlers.get('friendCall:incoming')(incoming));
  await click('Accept');
  await act(async () => state.handlers.get('friendCall:ended')({ roomId: incoming.roomId, reason: 'expired' }));
  await act(async () => state.ack(null, { success: true }));
  expect(host.textContent).not.toContain('End active call');
  expect(listLocalCalls('self')[0].status).toBe('expired');
});
it('resolves push details through the authenticated server before displaying a caller', async () => {
  await act(async () => window.dispatchEvent(new CustomEvent('friend-call:incoming-push', { detail: { roomId: incoming.roomId, fromName: 'Forged name' } })));
  expect(host.textContent).not.toContain('Forged name');
  expect(state.emit).toHaveBeenCalledWith('friendCall:details', { roomId: incoming.roomId });
  await act(async () => state.ack(null, { success: true, call: incoming }));
  expect(host.textContent).toContain('Arta');
});
it('closes active media when the verified social session expires', async () => {
  await act(async () => window.dispatchEvent(new CustomEvent('friend-call:start', { detail: incoming })));
  expect(host.textContent).toContain('End active call');
  await act(async () => state.handlers.get('social:authentication-required')());
  expect(host.textContent).not.toContain('End active call');
  expect(listLocalCalls('self')[0].status).toBe('disconnected');
});
