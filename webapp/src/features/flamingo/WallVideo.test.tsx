import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WallVideo, { WallVideoDownload, lockWallVideoScroll } from './WallVideo';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const file = {
  name: 'phone.mp4',
  type: 'video/mp4',
  size: 9_000_000,
  src: '/original.mp4',
  duration: 30
};
const props = {
  file,
  postId: '000000000000000000000001',
  apiBase: 'https://api.example.test',
  headers: () => ({ 'X-Wall-Owner-Token': 'viewer' })
};
const original = {
  quality: 'original',
  label: 'Original (1080p)',
  status: 'ready',
  url: '/original.mp4',
  width: 1080,
  height: 1920,
  size: file.size
};
const ready = {
  quality: '720p',
  label: '720p',
  status: 'ready',
  url: '/720p.mp4',
  width: 720,
  height: 1280,
  size: 3_000_000,
  name: 'phone-720p.mp4',
  type: 'video/mp4'
};
describe('wall video resolution controls', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ qualities: [original, ready] })
      }))
    );
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const click = async (selector: string) => {
    await act(async () =>
      document.querySelector<HTMLButtonElement>(selector)!.click()
    );
  };

  it('loads choices from the three-dot menu and preserves time, sound and play state on a source switch', async () => {
    await act(async () => root.render(<WallVideo {...props} />));
    expect(fetch).toHaveBeenCalledTimes(1);
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'playbackRate', {
      configurable: true,
      writable: true,
      value: 1
    });
    Object.defineProperty(video, 'paused', {
      configurable: true,
      value: false
    });
    Object.defineProperty(video, 'duration', { configurable: true, value: 60 });
    video.currentTime = 23;
    video.playbackRate = 1.5;
    video.volume = 0.4;
    video.muted = true;
    await click('[aria-label="Video options"]');
    expect(document.querySelector('[role="menu"]')?.textContent).toContain(
      '720p'
    );
    await click('[role="menuitemradio"]:last-of-type');
    expect(video.getAttribute('src')).toBe('https://api.example.test/720p.mp4');
    video.currentTime = 0;
    video.playbackRate = 1;
    video.volume = 1;
    video.muted = false;
    await act(async () => video.dispatchEvent(new Event('loadedmetadata')));
    expect(video.currentTime).toBe(23);
    expect(video.playbackRate).toBe(1.5);
    expect(video.volume).toBe(0.4);
    expect(video.muted).toBe(true);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
  it('selects ready 360p before loading original bytes and respects a later manual selection', async () => {
    const low = { ...ready, quality: '360p', label: '360p', url: '/360p.mp4' };
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ qualities: [original, ready, low] })
    } as Response);
    await act(async () => root.render(<WallVideo {...props} />));
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('https://api.example.test/360p.mp4');
    await click('[aria-label="Video options"]');
    expect(
      container.querySelector('[aria-checked="true"]')?.textContent
    ).toContain('360p');
    await click('[role="menuitemradio"]');
    expect(video.getAttribute('src')).toBe('/original.mp4');
    await click('[aria-label="Video options"]');
    expect(video.getAttribute('src')).toBe('/original.mp4');
  });
  it('requests the default 360p copy and switches when it finishes', async () => {
    vi.useFakeTimers();
    let ready360 = false;
    vi.mocked(fetch).mockImplementation(
      async (_url, init) =>
        ({
          ok: true,
          json: async () => ({
            qualities: [
              original,
              {
                ...ready,
                quality: '360p',
                label: '360p',
                url: '/360p.mp4',
                status: ready360
                  ? 'ready'
                  : init?.method === 'POST'
                    ? 'processing'
                    : 'available'
              }
            ],
            processing: !ready360
          })
        }) as Response
    );
    await act(async () => root.render(<WallVideo {...props} />));
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([, init]) =>
            init?.method === 'POST' &&
            init.body === JSON.stringify({ quality: '360p' })
        )
    ).toBe(true);
    ready360 = true;
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      'https://api.example.test/360p.mp4'
    );
  });
  it('leaves the original playable if the quality API fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    await act(async () => root.render(<WallVideo {...props} />));
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/original.mp4'
    );
  });
  it('keeps the current video playing while a requested resolution is being prepared', async () => {
    vi.mocked(fetch).mockImplementation(
      async (_url, init) =>
        ({
          ok: true,
          json: async () => ({
            qualities: [
              original,
              {
                ...ready,
                status: init?.method === 'POST' ? 'processing' : 'available',
                url: undefined
              }
            ],
            processing: true
          })
        }) as Response
    );
    await act(async () => root.render(<WallVideo {...props} />));
    await click('[aria-label="Video options"]');
    await click('[role="menuitemradio"]:last-of-type');
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/original.mp4'
    );
    expect(container.textContent).toContain('720p: Preparing');
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(call![1]!.body as string)).toEqual({ quality: '720p' });
  });
  it('falls back to the original if a prepared resolution cannot play', async () => {
    const onError = vi.fn();
    await act(async () =>
      root.render(<WallVideo {...props} onError={onError} />)
    );
    await click('[aria-label="Video options"]');
    await click('[role="menuitemradio"]:last-of-type');
    await act(async () =>
      container.querySelector('video')!.dispatchEvent(new Event('error'))
    );
    expect(container.querySelector('video')?.getAttribute('src')).toBe(
      '/original.mp4'
    );
    expect(onError).not.toHaveBeenCalled();
  });
  it('shows actual progress and queue position, then switches automatically when the copy is ready', async () => {
    vi.useFakeTimers();
    let quality = {
      ...ready,
      status: 'available',
      progress: undefined as number | undefined,
      remainingSeconds: undefined as number | undefined,
      queuePosition: undefined as number | undefined
    };
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      if (init?.method === 'POST')
        quality = {
          ...quality,
          status: 'processing',
          progress: 45,
          remainingSeconds: 36
        };
      return {
        ok: true,
        json: async () => ({
          qualities: [original, quality],
          processing: quality.status !== 'ready'
        })
      } as Response;
    });
    await act(async () => root.render(<WallVideo {...props} />));
    const video = container.querySelector('video')!;
    Object.defineProperty(video, 'duration', { configurable: true, value: 60 });
    video.currentTime = 12;
    await click('[aria-label="Video options"]');
    await click('[role="menuitemradio"]:last-of-type');
    expect(container.textContent).toContain('45%');
    expect(container.textContent).toContain('about 40s left');
    expect(video.getAttribute('src')).toBe('/original.mp4');
    quality = { ...quality, status: 'queued', queuePosition: 2 };
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(container.textContent).toContain('Queued · position 2');
    quality = { ...quality, ...ready };
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(video.getAttribute('src')).toBe('https://api.example.test/720p.mp4');
    video.currentTime = 0;
    await act(async () => video.dispatchEvent(new Event('loadedmetadata')));
    expect(video.currentTime).toBe(12);
  });
  it('promotes a queued download selection and leaves an original download usable during background work', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        qualities: [original, { ...ready, status: 'queued', queuePosition: 3 }],
        processing: true
      })
    } as Response);
    const onDownload = vi.fn(async () => {});
    await act(async () =>
      root.render(
        <WallVideoDownload
          {...props}
          onClose={() => {}}
          onDownload={onDownload}
        />
      )
    );
    expect(
      document.querySelector<HTMLButtonElement>('.wall-download-confirm')!
        .disabled
    ).toBe(false);
    expect(document.body.textContent).not.toContain('Keep this window open');
    await click('[role="radio"]:last-of-type');
    expect(document.body.textContent).toContain('Queued · position 3');
    expect(document.body.textContent).toContain(
      'You can close this window and come back'
    );
    const call = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(call![1]!.body as string)).toEqual({ quality: '720p' });
    expect(onDownload).not.toHaveBeenCalled();
  });
  it('confirms the selected download resolution and price without charging on selection', async () => {
    const onDownload = vi.fn(async () => {}),
      onClose = vi.fn();
    await act(async () =>
      root.render(
        <WallVideoDownload
          {...props}
          file={{ ...file, premium: true, priceTpg: 25 }}
          onClose={onClose}
          onDownload={onDownload}
        />
      )
    );
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      '25 TPG will be charged'
    );
    await click('[role="radio"]:last-of-type');
    expect(onDownload).not.toHaveBeenCalled();
    await click('.wall-download-confirm');
    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: '720p',
        name: 'phone-720p.mp4',
        size: 3_000_000
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it.each([19, 20, 40, 41, 3600])(
    'shows a free download for a non-premium %s-second video',
    async (duration) => {
      const onDownload = vi.fn(async () => {});
      await act(async () =>
        root.render(
          <WallVideoDownload
            {...props}
            file={{ ...file, duration, priceTpg: 300 }}
            onClose={() => {}}
            onDownload={onDownload}
          />
        )
      );
      expect(document.querySelector('.wall-download-price')?.textContent).toBe(
        'Free download'
      );
      expect(
        document.querySelector('.wall-download-confirm')?.textContent
      ).not.toContain('TPG');
      await click('[role="radio"]:last-of-type');
      expect(document.querySelector('.wall-download-price')?.textContent).toBe(
        'Free download'
      );
      await click('.wall-download-confirm');
      expect(onDownload).toHaveBeenCalledWith(
        expect.objectContaining({ quality: '720p' })
      );
    }
  );
  it('prevents downloading an unready rendition while the original remains selectable', async () => {
    vi.mocked(fetch).mockImplementation(
      async () =>
        ({
          ok: true,
          json: async () => ({
            qualities: [original, { ...ready, status: 'processing' }],
            processing: true
          })
        }) as Response
    );
    const onDownload = vi.fn(async () => {});
    await act(async () =>
      root.render(
        <WallVideoDownload
          {...props}
          onClose={() => {}}
          onDownload={onDownload}
        />
      )
    );
    await click('[role="radio"]:last-of-type');
    expect(
      document.querySelector<HTMLButtonElement>('.wall-download-confirm')!
        .disabled
    ).toBe(true);
    expect(onDownload).not.toHaveBeenCalled();
    await click('[role="radio"]:first-of-type');
    expect(
      document.querySelector<HTMLButtonElement>('.wall-download-confirm')!
        .disabled
    ).toBe(false);
  });
  it('preserves a fullscreen scroll lock when the download dialog closes', async () => {
    const previous = document.body.style.overflow;
    const releaseFullscreen = lockWallVideoScroll();
    await act(async () =>
      root.render(
        <WallVideoDownload
          {...props}
          onClose={() => {}}
          onDownload={async () => {}}
        />
      )
    );
    await act(async () => root.render(null));
    expect(document.body.style.overflow).toBe('hidden');
    releaseFullscreen();
    expect(document.body.style.overflow).toBe(previous);
  });
});
