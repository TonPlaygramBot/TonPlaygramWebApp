import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SpinRewardVideo from './SpinRewardVideo.tsx';
import SpinGame from './SpinGame.jsx';
import RouletteMini from './RouletteMini.jsx';
import { creditSpinReward } from '../utils/creditSpinReward.js';

vi.mock('../utils/api.js', () => ({ API_BASE_URL: '' }));
vi.mock('../utils/telegram.js', () => ({ getTelegramId: () => 12345 }));
vi.mock('../utils/creditSpinReward.js', () => ({ creditSpinReward: vi.fn().mockResolvedValue() }));
vi.mock('../utils/coinConfetti', () => ({ default: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const reel = { reelUrl: 'https://www.instagram.com/reel/latest/', mediaUrl: 'https://cdn.example/latest.mp4', thumbnailUrl: null };
let root, container, complete, close, hidden;
const button = (text) => [...document.querySelectorAll('button')].find((el) => el.textContent.includes(text));
async function render(rewardOpen = true) {
  await act(async () => root.render(<React.StrictMode><SpinRewardVideo reelUrl={null} rewardOpen={rewardOpen} onRewardComplete={complete} onRewardClose={close} /></React.StrictMode>));
}
function videoState(video, values) {
  for (const [key, value] of Object.entries(values)) Object.defineProperty(video, key, { configurable: true, writable: true, value });
}
async function event(video, name, values = {}) {
  await act(async () => {
    videoState(video, values);
    video.dispatchEvent(new Event(name));
  });
}
async function watch(video, ms) {
  await act(async () => {
    for (let t = 0; t < ms; t += 100) {
      video.currentTime += 0.1;
      await vi.advanceTimersByTimeAsync(100);
    }
  });
}
async function playing() {
  const video = document.querySelector('video');
  await event(video, 'playing', { paused: false, seeking: false, readyState: 4, currentTime: 0, duration: 30 });
  return video;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => reel }));
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  localStorage.clear();
  creditSpinReward.mockReset().mockResolvedValue(undefined);
  hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  complete = vi.fn();
  close = vi.fn();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Instagram reward playback', () => {
  it('opens a portrait video and requests muted inline autoplay', async () => {
    await render();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const video = document.querySelector('video');
    expect(video.src).toBe(reel.mediaUrl);
    expect(video.autoplay && video.muted && video.playsInline && video.loop).toBe(true);
    expect(video.play).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('/api/ads/spin-reel', expect.objectContaining({ cache: 'no-store' }));
    expect(button('Skip in 15s').disabled).toBe(true);
  });

  it('awards once after 15 seconds, stays open, and lets the user skip without losing the reward', async () => {
    await render();
    const video = await playing();
    await watch(video, 14900);
    expect(complete).not.toHaveBeenCalled();
    expect(button('Skip in').disabled).toBe(true);
    await watch(video, 100);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button('Skip video').disabled).toBe(false);
    await watch(video, 5000);
    await act(async () => button('Skip video').click());
    expect(complete).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('does not reward loading, buffering, pause, hidden playback, or seeking', async () => {
    await render();
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(complete).not.toHaveBeenCalled();
    const video = await playing();
    await watch(video, 5000);
    await event(video, 'waiting');
    await watch(video, 20000);
    await event(video, 'playing');
    await event(video, 'pause', { paused: true });
    await watch(video, 20000);
    await event(video, 'playing', { paused: false });
    hidden = true;
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await watch(video, 20000);
    localStorage.clear();
  creditSpinReward.mockReset().mockResolvedValue(undefined);
  hidden = false;
    await event(video, 'playing');
    await event(video, 'seeking', { seeking: true });
    await event(video, 'seeked', { seeking: false, currentTime: 200 });
    expect(complete).not.toHaveBeenCalled();
    await watch(video, 9900);
    expect(complete).not.toHaveBeenCalled();
    await watch(video, 100);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('keeps reward locked when media is missing or errors, and can retry', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ...reel, mediaUrl: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...reel, mediaUrl: null }) });
    await render();
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.body.textContent).toContain('reward video is unavailable');
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(complete).not.toHaveBeenCalled();
    await act(async () => button('Retry video').click());
    const video = await playing();
    await watch(video, 5000);
    await event(video, 'error');
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(complete).not.toHaveBeenCalled();
  });

  it('offers a play button if the browser rejects autoplay', async () => {
    HTMLMediaElement.prototype.play.mockRejectedValueOnce(new Error('NotAllowedError'));
    await render();
    expect(button('Play video')).toBeDefined();
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(complete).not.toHaveBeenCalled();
    await act(async () => button('Play video').click());
    await playing();
    expect(button('Play video')).toBeUndefined();
  });

  it('does not reward previews or early cancellation, and resets on reopening', async () => {
    await render(false);
    await act(async () => button('Watch latest').click());
    let video = await playing();
    await watch(video, 20000);
    expect(complete).not.toHaveBeenCalled();
    await act(async () => button('Close').click());
    await render(true);
    video = await playing();
    await watch(video, 10000);
    await act(async () => button('Cancel').click());
    expect(close).toHaveBeenCalledTimes(1);
    await render(false);
    await render(true);
    video = await playing();
    await watch(video, 5000);
    expect(complete).not.toHaveBeenCalled();
    await watch(video, 10000);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('counts short looping Reels and caps accelerated playback by elapsed time', async () => {
    await render();
    const video = await playing();
    video.duration = 5;
    await act(async () => {
      for (let i = 0; i < 150; i++) {
        video.currentTime = (video.currentTime + 0.2) % 5;
        await vi.advanceTimersByTimeAsync(100);
        if (i === 74) expect(complete).not.toHaveBeenCalled();
      }
    });
    expect(complete).toHaveBeenCalledTimes(1);
  });
});


describe.each([
  ['Spin & Win', SpinGame, 'Spin', 'spin'],
  ['Roulette', RouletteMini, 'Spin the Wheel', 'roulette'],
])('%s Earn integration', (_name, Game, label, type) => {
  it('starts exactly one wheel at 15 seconds and preserves its credit when skipped', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await act(async () => root.render(<Game />));
    const spin = [...document.querySelectorAll('button')].find(el => el.textContent === label);
    await act(async () => spin.click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const video = await playing();
    await watch(video, 14900);
    expect(creditSpinReward).not.toHaveBeenCalled();
    await watch(video, 100);
    expect(button('Skip video').disabled).toBe(false);
    await act(async () => button('Skip video').click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(5000));
    expect(creditSpinReward).toHaveBeenCalledTimes(1);
    expect(creditSpinReward).toHaveBeenCalledWith(12345, expect.any(Number), type);
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(creditSpinReward).toHaveBeenCalledTimes(1);
  });

  it('allows cancel before 15 seconds without consuming a spin or crediting a reward', async () => {
    await act(async () => root.render(<Game />));
    const spin = [...document.querySelectorAll('button')].find(el => el.textContent === label);
    await act(async () => spin.click());
    const video = await playing();
    await watch(video, 5000);
    await act(async () => button('Cancel').click());
    await act(async () => vi.advanceTimersByTimeAsync(20000));
    expect(creditSpinReward).not.toHaveBeenCalled();
    expect(spin.disabled).toBe(false);
    expect(localStorage.getItem('lastSpinAd')).toBeNull();
    expect(localStorage.getItem('lastSpin')).toBeNull();
    expect(localStorage.getItem('rouletteSpinTs')).toBeNull();
  });
});
