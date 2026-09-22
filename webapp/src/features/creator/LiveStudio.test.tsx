import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LiveStudio from './LiveStudio';
import { creatorApi } from './api';

vi.mock('./api', () => ({ creatorApi: vi.fn() }));
vi.mock('../../utils/api.js', () => ({ API_BASE_URL: 'https://studio.example' }));
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, node: HTMLDivElement;
const api = vi.mocked(creatorApi);
const mediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const getUserMedia = vi.fn();
const onError = vi.fn();
function camera() {
  const video = { stop: vi.fn(), addEventListener: vi.fn(), enabled: true };
  const audio = { stop: vi.fn(), enabled: true };
  return { video, audio, media: { getTracks: () => [video, audio], getVideoTracks: () => [video], getAudioTracks: () => [audio] } };
}
async function render(visible = true, signedIn = true) {
  await act(async () => root.render(<LiveStudio accounts={[]} platforms={[]} enabled={false} signedIn={signedIn} visible={visible} onError={onError} />));
}
async function enableCamera() {
  const button = [...node.querySelectorAll('button')].find(b => b.textContent?.includes('Enable camera'))!;
  await act(async () => button.click());
}
beforeEach(() => {
  vi.clearAllMocks();
  api.mockImplementation(async () => ({ live: null }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => {
  await act(async () => root.unmount()); node.remove(); vi.restoreAllMocks();
  if (mediaDevices) Object.defineProperty(navigator, 'mediaDevices', mediaDevices);
  else delete (navigator as any).mediaDevices;
});
it('releases a private camera and microphone when leaving the live tab', async () => {
  const { video, audio, media } = camera(); getUserMedia.mockResolvedValue(media);
  await render(); await enableCamera();
  expect(video.stop).not.toHaveBeenCalled();
  await render(false);
  expect(video.stop).toHaveBeenCalledOnce(); expect(audio.stop).toHaveBeenCalledOnce();
  expect(node.querySelector('video')?.srcObject).toBe(null);
});
it('disposes of camera permission results that arrive after leaving the tab', async () => {
  const { video, audio, media } = camera(); let resolve: (value: any) => void;
  getUserMedia.mockReturnValue(new Promise(r => { resolve = r; }));
  await render(); await enableCamera(); await render(false);
  await act(async () => resolve!(media));
  expect(video.stop).toHaveBeenCalledOnce(); expect(audio.stop).toHaveBeenCalledOnce();
  expect(node.querySelector('video')?.srcObject).toBe(null);
});
it('ignores a stale broadcast lookup after signing out', async () => {
  let resolve: (value: any) => void;
  api.mockReturnValue(new Promise(r => { resolve = r; }));
  await render(); await render(true, false);
  await act(async () => resolve!({ live: { id: 'previous-session', destinations: [] } }));
  expect(node.textContent).not.toContain('End broadcast everywhere');
});
