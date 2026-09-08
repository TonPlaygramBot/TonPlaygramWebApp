import { afterEach, expect, it, vi } from 'vitest';
import {
  dismissWallDownload,
  getWallDownloads,
  retryWallDownload,
  saveWallDownload,
  saveWallDownloadInBrowser,
  startWallDownload
} from './wallDownloads';
import {
  hasWallTransfers,
  retainWallTransfer
} from './wallTransferActivity.js';
import { createAppReloadScheduler } from '../../hooks/scheduleAppReload.js';

const request = {
  url: '/original.mp4',
  name: 'clip.mp4',
  grant: {
    url: '/api/download',
    headers: { 'X-Wall-Owner-Token': 'owner' },
    quality: '360p'
  }
};
const tick = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
afterEach(() => {
  for (const job of getWallDownloads()) dismissWallDownload(job.id);
  delete (window as any).Telegram;
  retainWallTransfer('test-upload', false);
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('respects native cancellation and does not open an unwanted browser download', async () => {
  const browser = vi.fn();
  (window as any).Telegram = {
    WebApp: {
      downloadFile: vi.fn((_args, callback) => callback(false)),
      openLink: browser
    }
  };
  startWallDownload({ url: '/file.mp4', name: 'file.mp4' });
  await tick();
  expect(getWallDownloads()[0].phase).toBe('cancelled');
  expect(browser).not.toHaveBeenCalled();
  expect(hasWallTransfers()).toBe(true); // Keep the paid grant available until dismissed.
});

it('uses the same payment request ID after a lost response and when renewing an expired link', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Network interrupted'))
    .mockResolvedValue({
      ok: true,
      json: async () => ({ downloadUrl: '/signed/clip' })
    });
  vi.stubGlobal('fetch', fetcher);
  const id = startWallDownload(request);
  await tick();
  expect(getWallDownloads()[0].phase).toBe('error');
  retryWallDownload(id);
  await tick();
  expect(getWallDownloads()[0].phase).toBe('ready');
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5 * 60 * 1000);
  saveWallDownload(id);
  await tick();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(
    fetcher.mock.calls.map(([, init]) => JSON.parse(init.body).requestId)
  ).toEqual([id, id, id]);
  expect(getWallDownloads()[0].phase).toBe('ready');
});

it('hands browser downloads to the device on a fresh click without fetching video bytes', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ downloadUrl: '/signed/clip' })
  });
  vi.stubGlobal('fetch', fetcher);
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const id = startWallDownload(request);
  await tick();
  expect(click).not.toHaveBeenCalled();
  expect(getWallDownloads()[0].phase).toBe('ready');
  saveWallDownload(id);
  expect(click).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(getWallDownloads()[0].phase).toBe('sent');
  expect(location.pathname).toBe('/');
});

it('reuses a failed download when the user presses Download again on the wall', async () => {
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Response lost'))
    .mockResolvedValue({
      ok: true,
      json: async () => ({ downloadUrl: '/signed/clip' })
    });
  vi.stubGlobal('fetch', fetcher);
  const id = startWallDownload(request);
  await tick();
  expect(startWallDownload(request)).toBe(id);
  await tick();
  expect(getWallDownloads()).toHaveLength(1);
  expect(
    fetcher.mock.calls.map(([, init]) => JSON.parse(init.body).requestId)
  ).toEqual([id, id]);
});

it('keeps a browser fallback available when Telegram exposes an unsupported native method', async () => {
  const openLink = vi.fn();
  (window as any).Telegram = {
    WebApp: {
      downloadFile: () => {
        throw new Error('Unsupported');
      },
      openLink
    }
  };
  const id = startWallDownload({ url: '/file.mp4', name: 'file.mp4' });
  await tick();
  expect(getWallDownloads()[0].phase).toBe('ready');
  expect(openLink).not.toHaveBeenCalled();
  saveWallDownloadInBrowser(id);
  expect(openLink).toHaveBeenCalledTimes(1);
  expect(getWallDownloads()[0].phase).toBe('sent');
});

it('defers automatic updates for uploads, paused files and games, then reloads once idle', () => {
  vi.useFakeTimers();
  const onReload = vi.fn();
  const onUpdating = vi.fn();
  const scheduler = createAppReloadScheduler({ onReload, onUpdating });
  retainWallTransfer('test-upload', true);
  scheduler.request();
  vi.advanceTimersByTime(10000);
  expect(onReload).not.toHaveBeenCalled();
  localStorage.setItem('tonplaygram-game-active', 'true');
  retainWallTransfer('test-upload', false);
  window.dispatchEvent(new Event('tonplaygram-game-ended'));
  vi.advanceTimersByTime(1000);
  expect(onReload).not.toHaveBeenCalled();
  localStorage.removeItem('tonplaygram-game-active');
  window.dispatchEvent(new Event('tonplaygram-game-ended'));
  vi.advanceTimersByTime(750);
  expect(onReload).toHaveBeenCalledTimes(1);
  scheduler.dispose();
});

it('cancels a scheduled reload if a file is selected during the update animation', () => {
  vi.useFakeTimers();
  const onReload = vi.fn();
  const scheduler = createAppReloadScheduler({ onReload, onUpdating: vi.fn() });
  scheduler.request();
  vi.advanceTimersByTime(300);
  retainWallTransfer('test-upload', true);
  vi.advanceTimersByTime(1000);
  expect(onReload).not.toHaveBeenCalled();
  retainWallTransfer('test-upload', false);
  vi.advanceTimersByTime(749);
  expect(onReload).not.toHaveBeenCalled();
  scheduler.dispose();
  vi.advanceTimersByTime(1000);
  expect(onReload).not.toHaveBeenCalled();
});
