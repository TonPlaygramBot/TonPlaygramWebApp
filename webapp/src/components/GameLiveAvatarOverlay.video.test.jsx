import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GameLiveAvatarOverlay from './GameLiveAvatarOverlay.jsx';
import AvatarTimer from './AvatarTimer.jsx';
import { buildGameLiveChatRoomId } from '../utils/liveVideoRoom.js';

const { socket, listeners } = vi.hoisted(() => {
  const listeners = new Map();
  return {
    listeners,
    socket: {
      id: 'self-socket', connected: true, emit: vi.fn(), connect: vi.fn(),
      on: vi.fn((event, handler) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(handler);
      }),
      off: vi.fn((event, handler) => listeners.get(event)?.delete(handler))
    }
  };
});
vi.mock('../utils/socket.js', () => ({ socket }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe.each(['checkersbattleroyal', 'poolroyale'])('%s shared live video', (defaultGame) => {
  let root, container, navigate, getUserMedia, stream, connections, gameSlug;
  const roomId = `live-${defaultGame}-match-42`;
  const avatarSize = defaultGame === 'poolroyale' ? '46.4px' : '52px';
  const track = (kind) => ({ kind, enabled: true, stop: vi.fn() });
  const makeStream = () => {
    const tracks = [track('audio'), track('video')];
    return { getTracks: () => tracks, getAudioTracks: () => [tracks[0]], getVideoTracks: () => [tracks[1]] };
  };
  const button = (label) => container.querySelector(`button[aria-label="${label}"]`);
  async function frame() {
    await act(async () => { await vi.advanceTimersByTimeAsync(32); });
  }
  async function click(label) {
    expect(button(label), label).not.toBeNull();
    await act(async () => button(label).click());
    await frame();
  }
  async function receive(event, payload) {
    await act(async () => {
      for (const handler of listeners.get(event) || []) await handler(payload);
    });
  }
  function Game({ blocked = false }) {
    navigate = useNavigate();
    return <GameLiveAvatarOverlay gameSlug={gameSlug} onlineOnly={['checkersbattleroyal', 'poolroyale'].includes(gameSlug)}>
      <div data-live-video-blocking={blocked ? 'true' : 'false'}>
        <div data-self-player="false" data-player-index="0">{gameSlug === 'poolroyale' ? <img data-pool-avatar="opponent" alt="Rival" /> : <AvatarTimer index={0} name="Rival" />}<span>Rival</span></div>
        <div data-self-player="true" data-player-index="1">{gameSlug === 'poolroyale' ? <img data-pool-avatar="self" alt="You" /> : <AvatarTimer index={1} name="You" isTurn active />}<span>You</span></div>
        <button aria-label="Replay last move">Replay</button>
      </div>
    </GameLiveAvatarOverlay>;
  }
  async function render(blocked = false) {
    await act(async () => root.render(<React.StrictMode><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Game blocked={blocked} /></BrowserRouter></React.StrictMode>));
    await frame();
  }
  async function mount(search = '?mode=online&tableId=match-42&accountId=one') {
    window.history.replaceState({}, '', `/games/${gameSlug}${search}`);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await render();
  }
  beforeEach(() => {
    vi.useFakeTimers();
    gameSlug = defaultGame;
    listeners.clear();
    socket.emit.mockClear();
    connections = [];
    stream = makeStream();
    getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('RTCSessionDescription', class { constructor(value) { Object.assign(this, value); } });
    vi.stubGlobal('RTCPeerConnection', class {
      constructor() { connections.push(this); this.addTrack = vi.fn(); this.close = vi.fn(); }
      async setRemoteDescription(sdp) { this.remoteDescription = sdp; }
      async createAnswer() { return { type: 'answer', sdp: 'mock-answer' }; }
      async createOffer() { return { type: 'offer', sdp: 'mock-offer' }; }
      async setLocalDescription(sdp) { this.localDescription = sdp; }
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const self = this.closest('[data-self-player="true"]');
      const opponent = this.closest('[data-self-player="false"]');
      const photo = this.tagName === 'IMG';
      const width = photo ? gameSlug === 'poolroyale' ? 46.4 : 52 : 110;
      return { top: self ? 560 : opponent ? 115 : 0, left: 139, width, height: photo ? width : 80, right: 139 + width, bottom: 640 };
    });
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    root = null;
    container?.remove();
    expect([...listeners.values()].every((handlers) => handlers.size === 0)).toBe(true);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('requests media once after tapping the actual local photo and joins the match', async () => {
    await mount();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(button('Turn on live avatar video').style.width).toBe(avatarSize);
    expect(button('Turn on live avatar video').style.top).toBe('560px');
    await click('Turn on live avatar video');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('liveChat:join', expect.objectContaining({ roomId }));
    expect(container.querySelector('video').srcObject).toBe(stream);
    expect(container.querySelector('video').muted).toBe(true);
    expect(container.querySelector('[data-self-player="true"]').style.visibility).toBe('');
    expect(container.querySelector('[data-self-player="true"] img').style.visibility).toBe('hidden');
    if (defaultGame === 'checkersbattleroyal') {
      expect(container.querySelector('.avatar-timer-ring')).not.toBeNull();
      expect(button('End video call').parentElement.parentElement.style.left).toBe('12px');
      expect(button('End video call').parentElement.parentElement.style.top).toBe('auto');
    } else {
      expect(button('Turn off live avatar video').style.width).toBe(avatarSize);
      expect(button('Turn off live avatar video').style.height).toBe(avatarSize);
      expect(button('End video call').parentElement.parentElement.style.left).toBe('50%');
    }
  });

  it('uses one room for both sides while separating matches and other games', () => {
    const params = new URLSearchParams('mode=online&tableId=match-42&accountId=one&side=light');
    const rival = new URLSearchParams('mode=online&tableId=match-42&accountId=two&side=dark');
    expect(buildGameLiveChatRoomId(defaultGame, params)).toBe(roomId);
    expect(buildGameLiveChatRoomId(defaultGame, rival)).toBe(roomId);
    expect(buildGameLiveChatRoomId('chessbattleroyal', params)).not.toBe(roomId);
    expect(buildGameLiveChatRoomId(defaultGame, new URLSearchParams('tableId=another'))).not.toBe(roomId);
  });

  it.each(['?mode=ai', '', '?mode=online', '?mode=online&table=cosmetic', '?mode=online&tableId=%20'])('has no call in practice or an incomplete match: %s', async (search) => {
    await mount(search);
    await act(async () => window.dispatchEvent(new CustomEvent('tonplaygram:live-avatar:start', { detail: { gameSlug: defaultGame } })));
    expect(button('Turn on live avatar video')).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalledWith('liveChat:join', expect.anything());
  });

  it('negotiates the shared signaling protocol and renders audible inline opponent video', async () => {
    await mount();
    await click('Turn on live avatar video');
    await receive('liveChat:signal', { roomId, fromSocketId: 'rival', participant: { displayName: 'Rival' }, data: { type: 'offer', sdp: { type: 'offer', sdp: 'mock' } } });
    expect(connections[0].addTrack).toHaveBeenCalledTimes(2);
    expect(socket.emit).toHaveBeenCalledWith('liveChat:signal', expect.objectContaining({ roomId, targetSocketId: 'rival', data: expect.objectContaining({ type: 'answer' }) }));
    const remoteStream = makeStream();
    await act(async () => connections[0].ontrack({ streams: [remoteStream] }));
    const video = container.querySelector('video[aria-label="Rival live video"]');
    expect(video.srcObject).toBe(remoteStream);
    expect(video.muted).toBe(false);
    expect(video.playsInline).toBe(true);
    expect(video.parentElement.parentElement.style.top).toBe('115px');
    expect(video.parentElement.parentElement.style.width).toBe(avatarSize);
    expect(video.parentElement.parentElement.style.height).toBe(avatarSize);
    await click('End video call');
    expect(connections[0].close).toHaveBeenCalled();
    expect(video.srcObject).toBeNull();
  });

  it('toggles camera and microphone independently, then releases tracks and restores photos', async () => {
    await mount();
    await click('Turn on live avatar video');
    await click('Turn microphone off');
    expect(stream.getAudioTracks()[0].enabled).toBe(false);
    expect(stream.getVideoTracks()[0].enabled).toBe(true);
    await click('Turn camera off');
    expect(stream.getVideoTracks()[0].enabled).toBe(false);
    expect(socket.emit).toHaveBeenCalledWith('liveChat:media_state', { roomId, mediaState: { microphone: false, camera: false } });
    await click('End video call');
    expect(stream.getTracks().every((track) => track.stop.mock.calls.length === 1)).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('liveChat:leave', { roomId });
    expect(container.querySelectorAll('video').length).toBe(0);
    expect(container.querySelector('[data-self-player="true"] img').style.visibility).toBe('');
    expect(container.querySelector('[data-self-player="false"] img').style.visibility).toBe('');
  });

  it('hides call controls while settings, gifts or results block the board', async () => {
    await mount();
    await click('Turn on live avatar video');
    await render(true);
    expect(button('End video call').parentElement.parentElement.style.visibility).toBe('hidden');
    expect(button('Turn off live avatar video').style.visibility).toBe('hidden');
    await render(false);
    expect(button('End video call').parentElement.parentElement.style.visibility).toBe('visible');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('rejoins the same match after a socket reconnect without reacquiring media', async () => {
    await mount();
    await click('Turn on live avatar video');
    socket.emit.mockClear();
    await receive('connect');
    expect(socket.emit).toHaveBeenCalledWith('liveChat:join', expect.objectContaining({ roomId }));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('ends the old call on a match change and waits for another deliberate tap', async () => {
    await mount();
    await click('Turn on live avatar video');
    await act(async () => navigate(`/games/${defaultGame}?mode=online&tableId=next-match`));
    await frame();
    expect(stream.getTracks().every((track) => track.stop.mock.calls.length === 1)).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith('liveChat:leave', { roomId });
    expect(button('Turn on live avatar video')).not.toBeNull();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(socket.emit).not.toHaveBeenCalledWith('liveChat:join', expect.objectContaining({ roomId: `live-${defaultGame}-next-match` }));
  });

  it('releases late permission results when the player leaves during the permission prompt', async () => {
    let resolveMedia;
    getUserMedia.mockReturnValue(new Promise((resolve) => { resolveMedia = resolve; }));
    await mount();
    await click('Turn on live avatar video');
    await act(async () => root.unmount());
    root = null;
    await act(async () => resolveMedia(stream));
    expect(stream.getTracks().every((track) => track.stop.mock.calls.length === 1)).toBe(true);
    expect(socket.emit).not.toHaveBeenCalledWith('liveChat:join', expect.anything());
  });

  it('shows permission errors and allows the player to retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getUserMedia.mockRejectedValueOnce(new Error('Camera permission denied'));
    await mount();
    await click('Turn on live avatar video');
    expect(container.querySelector('[role="alert"]').textContent).toContain('Camera permission denied');
    await click('End video call');
    await click('Turn on live avatar video');
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(socket.emit).toHaveBeenCalledWith('liveChat:join', expect.objectContaining({ roomId }));
  });

  it('can restart while a cancelled permission request is still pending', async () => {
    let resolveOld;
    getUserMedia.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
    await mount();
    await click('Turn on live avatar video');
    await click('End video call');
    await click('Turn on live avatar video');
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    const oldStream = makeStream();
    await act(async () => resolveOld(oldStream));
    expect(oldStream.getTracks().every((track) => track.stop.mock.calls.length === 1)).toBe(true);
    expect(stream.getTracks().every((track) => track.stop.mock.calls.length === 0)).toBe(true);
    expect(container.querySelector('video').srcObject).toBe(stream);
  });

  it('can retry after media APIs become available', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    navigator.mediaDevices.getUserMedia = undefined;
    await mount();
    await click('Turn on live avatar video');
    expect(container.querySelector('[role="alert"]').textContent).toContain('unavailable');
    await click('End video call');
    navigator.mediaDevices.getUserMedia = getUserMedia;
    await click('Turn on live avatar video');
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(container.querySelector('video').srcObject).toBe(stream);
  });

  it('ignores an old permission error after a new call has started', async () => {
    let rejectOld;
    getUserMedia.mockReturnValueOnce(new Promise((_, reject) => { rejectOld = reject; }));
    await mount();
    await click('Turn on live avatar video');
    await click('End video call');
    await click('Turn on live avatar video');
    await act(async () => rejectOld(new Error('Old permission request cancelled')));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('video').srcObject).toBe(stream);
  });

  it('keeps Pool video tied to mounted photos and reattaches the same stream', async () => {
    if (defaultGame !== 'poolroyale') return;
    await mount();
    await click('Turn on live avatar video');
    const photo = container.querySelector('[data-pool-avatar="self"]');
    const owner = photo.parentElement;
    await act(async () => photo.remove());
    await frame();
    expect(button('Turn off live avatar video')).toBeNull();
    await act(async () => owner.prepend(photo));
    await frame();
    expect(container.querySelector('video').srcObject).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it.each(['chessbattleroyal', 'domino-royal', 'murlanroyale'])('preserves shared call start and cleanup in %s', async (slug) => {
    gameSlug = slug;
    await mount();
    if (slug === 'domino-royal') {
      container.querySelector('[data-self-player="false"] img').classList.add('seat-badge-core');
      await frame();
    }
    await click('Turn on live avatar video');
    expect(socket.emit).toHaveBeenCalledWith('liveChat:join', expect.objectContaining({ roomId: `live-${slug}-match-42` }));
    await click('Turn off live avatar video');
    expect(stream.getTracks().every((track) => track.stop.mock.calls.length === 1)).toBe(true);
    expect(container.querySelector('[data-self-player="false"] img').style.visibility).toBe('');
  });
});
