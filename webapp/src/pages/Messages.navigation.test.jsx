import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Messages from './Messages.jsx';
import { clearLocalCalls, listLocalCalls, recordLocalCall } from '../utils/socialHubState.js';

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(), prepare: vi.fn(), load: vi.fn(), send: vi.fn(), decrypt: vi.fn(), remove: vi.fn(), clear: vi.fn(),
  release: vi.fn(), accept: vi.fn(), reset: vi.fn(), listeners: new Map(),
  submitReport: vi.fn(), friends: vi.fn(), requests: vi.fn(), read: vi.fn(), emit: vi.fn()
}));
vi.mock('../hooks/useTelegramBackButton.js', () => ({ default: () => {} }));
vi.mock('../components/LeaderboardCard.jsx', () => ({ default: () => <div>Leaderboard</div> }));
vi.mock('../components/LinkGoogleButton.jsx', () => ({ default: () => <button>Sign in with Google</button> }));
vi.mock('../utils/telegram.js', () => ({ getPlayerId: () => 'self', getTelegramId: () => 1 }));
vi.mock('../utils/api.js', () => ({
  listFriends: (...args) => mocks.friends(...args), listFriendRequests: (...args) => mocks.requests(...args),
  markInboxRead: (...args) => mocks.read(...args), acceptFriendRequest: vi.fn(), rejectFriendRequest: vi.fn()
}));
vi.mock('../utils/socket.js', () => ({ socket: {
  connected: true, connect: vi.fn(), emit: (...args) => mocks.emit(...args),
  on: (event, handler) => { const handlers = mocks.listeners.get(event) || new Set(); handlers.add(handler); mocks.listeners.set(event, handlers); },
  off: (event, handler) => mocks.listeners.get(event)?.delete(handler)
} }));
vi.mock('../utils/secureMessages.js', () => ({
  initializeSecureMessaging: (...args) => mocks.initialize(...args),
  prepareConversation: (...args) => mocks.prepare(...args), loadMessages: (...args) => mocks.load(...args),
  sendSecureMessage: (...args) => mocks.send(...args), decryptMessages: (...args) => mocks.decrypt(...args),
  deleteSecureMessage: (...args) => mocks.remove(...args), clearSecureConversation: (...args) => mocks.clear(...args),
  releaseMessageAttachments: (...args) => mocks.release(...args), acceptPeerKeyChange: (...args) => mocks.accept(...args),
  resetConversationDeviceKey: (...args) => mocks.reset(...args),
  submitSocialReport: (...args) => mocks.submitReport(...args)
}));

const NOW = Date.now();
const row = (id, text, changes = {}) => ({ _id: id, from: 'self', to: 'peer', text, createdAt: new Date(NOW - 60000).toISOString(), ...changes });
const readyContext = peerId => ({ selfId: 'self', peerId, canSend: true, security: 'encrypted', ownFingerprint: 'SELF-CODE', peerFingerprint: 'PEER-CODE' });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Social Hub privacy and conversation controls', () => {
  let container, root;
  const byLabel = label => container.querySelector(`[aria-label="${label}"]`);
  const button = text => [...container.querySelectorAll('button')].find(element => element.textContent.trim() === text);
  const click = async element => { expect(element).toBeTruthy(); await act(async () => element.click()); };
  const type = async (element, value) => { await act(async () => { Object.getOwnPropertyDescriptor(element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); }); };
  const dispatch = async (event, data) => { await act(async () => { await Promise.all([...mocks.listeners.get(event) || []].map(handler => handler(data))); }); };
  const render = async () => { await act(async () => root.render(<Messages />)); };
  const open = async (name = 'Arta') => click([...container.querySelectorAll('.hub-person')].find(element => element.textContent.includes(name)));

  beforeEach(() => {
    vi.clearAllMocks(); mocks.listeners.clear(); localStorage.clear();
    mocks.friends.mockResolvedValue([{ accountId: 'peer', telegramId: 2, nickname: 'Arta' }, { accountId: 'other', telegramId: 3, nickname: 'Besa' }]);
    mocks.submitReport.mockResolvedValue({ status: 'received' });
    mocks.requests.mockResolvedValue([]); mocks.read.mockResolvedValue({ success: true });
    mocks.initialize.mockResolvedValue({ selfId: 'self', isReady: true, securityReason: null });
    mocks.prepare.mockImplementation(async (_self, peer) => readyContext(peer));
    mocks.load.mockResolvedValue([]); mocks.decrypt.mockImplementation(async (_context, rows) => rows);
    mocks.send.mockResolvedValue(row('sent-1', 'Hello privately'));
    mocks.remove.mockResolvedValue({ success: true }); mocks.clear.mockResolvedValue({ cutoffAt: new Date(NOW).toISOString() });
    mocks.accept.mockImplementation(async ctx => ({ ...ctx, canSend: true, securityReason: null }));
    mocks.reset.mockImplementation(async ctx => ({ ...ctx, canSend: true, securityReason: null }));
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });

  const openReport = async () => {
    await click(byLabel('Conversation options'));
    await click([...container.querySelectorAll('.hub-option')].find(element => element.textContent.includes('Report player')));
  };
  it('reports only selected canonical account and category after explicit confirmation', async () => {
    await render(); await open(); await openReport();
    expect(mocks.submitReport).not.toHaveBeenCalled();
    expect(container.textContent).toContain('will not be included');
    await click(button('Submit report'));
    expect(mocks.submitReport).toHaveBeenCalledWith('peer', 'harassment', expect.any(String));
    expect(container.textContent).toContain('Report received. This does not block the player.');
  });
  it('cancel never submits, failed requests retain the same id on retry', async () => {
    await render(); await open(); await openReport(); await click(byLabel('Close dialog'));
    expect(mocks.submitReport).not.toHaveBeenCalled(); await openReport();
    mocks.submitReport.mockRejectedValueOnce(new Error('Network failed'));
    await click(button('Submit report')); expect(container.textContent).not.toContain('Report received.');
    await click(button('Submit report'));
    expect(mocks.submitReport.mock.calls[0]).toEqual(mocks.submitReport.mock.calls[1]);
  });
  it('repeated taps submit once and delayed response does not close another conversation sheet', async () => {
    const pending = deferred(); mocks.submitReport.mockReturnValue(pending.promise);
    await render(); await open(); await openReport(); await click(button('Submit report'));
    await click(button('Submitting…')); expect(mocks.submitReport).toHaveBeenCalledTimes(1);
    await click(byLabel('Back to conversations')); await open('Besa'); await click(byLabel('Conversation options'));
    await act(async () => pending.resolve({ status: 'received' }));
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).not.toContain('Report received.');
  });

  it('shows real people and empty call history without invented online, unread or notification data', async () => {
    await render();
    expect(container.textContent).not.toContain('Online');
    expect(container.querySelectorAll('.hub-person')).toHaveLength(2);
    await click(button('Calls'));
    expect(container.textContent).toContain('No call activity');
    expect(container.querySelectorAll('.hub-call')).toHaveLength(0);
  });

  it('sends through encryption with chosen timer and no plaintext path', async () => {
    await render(); await open();
    await click(button('Disappearing: Off')); await click([...container.querySelectorAll('.hub-timers button')].find(element => element.textContent.includes('24 hours')));
    await type(byLabel('Message'), 'Hello privately'); await click(byLabel('Send encrypted message'));
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ peerId: 'peer', canSend: true }), { text: 'Hello privately', attachment: null, replyTo: null, ttlSeconds: 86400 });
    expect(container.textContent).toContain('Hello privately');
    expect(byLabel('Message').value).toBe('');
  });

  it('deduplicates live delivery and enforces both conversation participants', async () => {
    mocks.load.mockResolvedValue([row('m1', 'Existing')]); await render(); await open();
    await dispatch('privateMessage', row('m1', 'Existing'));
    await dispatch('privateMessage', row('alien', 'Someone else', { from: 'outsider', to: 'peer' }));
    expect(container.querySelectorAll('.hub-message')).toHaveLength(1);
    expect(container.textContent).not.toContain('Someone else');
  });

  it('does not leak a delayed history response into a different conversation', async () => {
    const pending = deferred(); mocks.load.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([row('besa', 'Besa message', { to: 'other' })]);
    await render(); await open(); await click(byLabel('Back to conversations')); await open('Besa');
    await act(async () => pending.resolve([row('arta', 'Arta private history')]));
    expect(container.textContent).toContain('Besa message'); expect(container.textContent).not.toContain('Arta private history');
  });

  it('uses the raw page cursor when every decoded row has expired', async () => {
    const emptyPage = Object.assign([], { hasMore: true, nextCursor: 'raw-expired-cursor' });
    mocks.load.mockResolvedValueOnce(emptyPage).mockResolvedValueOnce(Object.assign([row('older', 'Older message')], { hasMore: false, nextCursor: 'older' }));
    await render(); await open(); await click(button('Load earlier messages'));
    expect(mocks.load.mock.calls[1][1]).toEqual({ before: 'raw-expired-cursor', limit: 50 });
    expect(container.textContent).toContain('Older message'); expect(button('Load earlier messages')).toBeUndefined();
  });

  it('does not append a delayed send into the next conversation or erase its draft', async () => {
    const pending = deferred(); mocks.send.mockReturnValue(pending.promise);
    await render(); await open(); await type(byLabel('Message'), 'First chat'); await click(byLabel('Send encrypted message'));
    await click(byLabel('Back to conversations')); await open('Besa'); await type(byLabel('Message'), 'Second draft');
    await act(async () => pending.resolve(row('late-send', 'First chat')));
    expect(byLabel('Message').value).toBe('Second draft');
    expect(container.textContent).not.toContain('First chat');
  });

  it('removes expired messages and destroys reply quotes derived from them', async () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    mocks.load.mockResolvedValue([row('original', 'Secret quote', { expiresAt: new Date(NOW + 2000).toISOString() }), row('reply', 'My reply', { replyTo: { id: 'original', from: 'self' } })]);
    await render(); await open();
    expect(container.querySelector('.hub-quote').textContent).toContain('Secret quote');
    await act(async () => vi.advanceTimersByTime(2500));
    expect(container.textContent).not.toContain('Secret quote');
    expect(container.querySelector('.hub-quote').textContent).toContain('Original message unavailable');
  });

  it('keeps only reply references in newly sent payloads', async () => {
    mocks.load.mockResolvedValue([row('original', 'Do not copy this plaintext')]);
    await render(); await open(); await click(byLabel('Actions for your message')); await click(button('Reply privately'));
    await type(byLabel('Message'), 'Reply'); await click(byLabel('Send encrypted message'));
    expect(mocks.send.mock.calls[0][1].replyTo).toEqual({ id: 'original', from: 'self' });
  });

  it('deletes a sender message for everyone only after the explicit confirmation', async () => {
    mocks.load.mockResolvedValue([row('m1', 'Remove me')]); await render(); await open();
    await click(byLabel('Actions for your message')); await click([...container.querySelectorAll('.hub-option')].find(element => element.textContent.includes('Delete for everyone')));
    expect(mocks.remove).not.toHaveBeenCalled();
    await click(button('Delete for everyone'));
    expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ peerId: 'peer' }), 'm1', 'everyone');
    expect(container.textContent).not.toContain('Remove me');
  });

  it('does not resurrect a message whose decryption finishes after clear, while preserving newer messages', async () => {
    const pending = deferred(); mocks.decrypt.mockReturnValueOnce(pending.promise);
    await render(); await open();
    let incoming;
    await act(async () => { incoming = [...mocks.listeners.get('privateMessage')][0](row('old', 'Late old message')); });
    await dispatch('privateMessage:cleared', { withId: 'peer', cutoffAt: new Date(NOW).toISOString() });
    await act(async () => { pending.resolve([row('old', 'Late old message')]); await incoming; });
    await dispatch('privateMessage', row('new', 'After clear', { createdAt: new Date(NOW + 1000).toISOString() }));
    expect(container.textContent).not.toContain('Late old message');
    expect(container.textContent).toContain('After clear');
  });

  it('keeps post-cutoff messages received while a clear request is pending', async () => {
    const pending = deferred(); mocks.clear.mockReturnValue(pending.promise); mocks.load.mockResolvedValue([row('old', 'Before clear')]);
    await render(); await open(); await click(byLabel('Conversation options'));
    await click([...container.querySelectorAll('.hub-option')].find(element => element.textContent.includes('Clear conversation for me')));
    await click(button('Clear conversation for me'));
    await dispatch('privateMessage', row('new', 'After clear', { createdAt: new Date(NOW + 1000).toISOString() }));
    await act(async () => pending.resolve({ cutoffAt: new Date(NOW).toISOString() }));
    expect(container.textContent).not.toContain('Before clear'); expect(container.textContent).toContain('After clear');
  });

  it('pauses sending on a key change until an explicit external-code verification', async () => {
    mocks.prepare.mockResolvedValue({ ...readyContext('peer'), canSend: false, securityReason: 'KEY_CHANGED' });
    await render(); await open(); expect(byLabel('Send encrypted message').disabled).toBe(true);
    await click(button('Review key')); expect(button('Trust verified new key').disabled).toBe(true);
    await click(container.querySelector('.hub-checkbox input')); await click(button('Trust verified new key'));
    expect(mocks.accept).toHaveBeenCalledTimes(1);
  });

  it('clears decrypted state and offers reauthentication after socket authentication expires', async () => {
    mocks.load.mockResolvedValue([row('secret', 'Private existing message')]); await render(); await open();
    await type(byLabel('Message'), 'Private draft'); await dispatch('social:authentication-required', {});
    expect(container.textContent).not.toContain('Private existing message');
    expect(container.textContent).toContain('Verify your identity to continue');
    expect(byLabel('Message')).toBeNull();
  });

  it('requires explicit missing-key confirmation before replacement', async () => {
    mocks.prepare.mockResolvedValue({ ...readyContext('peer'), canSend: false, securityReason: 'DEVICE_KEY_UNAVAILABLE' });
    await render(); await open(); await click(button('Device key options'));
    expect(button('Replace active key for this device').disabled).toBe(true);
    await click(container.querySelector('.hub-checkbox input')); await click(button('Replace active key for this device'));
    expect(mocks.reset).toHaveBeenCalledTimes(1);
  });
});

describe('local call metadata privacy', () => {
  beforeEach(() => localStorage.clear());
  it('scopes records by account, deduplicates a call and excludes media/signaling', () => {
    recordLocalCall('alice', { roomId: 'call-a', toAccountId: 'bob', toName: 'Bob', type: 'voice', sdp: 'secret', token: 'private' });
    recordLocalCall('alice', { roomId: 'call-a', toAccountId: 'bob', toName: 'Bob' }, { status: 'ended' });
    expect(listLocalCalls('alice')).toHaveLength(1); expect(listLocalCalls('bob')).toHaveLength(0);
    expect(JSON.stringify(listLocalCalls('alice'))).not.toMatch(/secret|private|sdp|token/);
    clearLocalCalls('alice', 'call-a'); expect(listLocalCalls('alice')).toEqual([]);
  });
  it('expires local call history after seven days', () => {
    recordLocalCall('alice', { roomId: 'call-a', toAccountId: 'bob', toName: 'Bob' });
    expect(listLocalCalls('alice', Date.now() + 8 * 86400000)).toEqual([]);
  });
});
