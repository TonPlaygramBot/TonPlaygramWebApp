import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WallComposerSlot, WallTransfersProvider } from './WallTransfers';
import { uploadWallFile } from './wallUpload.js';
import { hasWallTransfers } from './wallTransferActivity.js';
import {
  dismissWallDownload,
  getWallDownloads,
  startWallDownload
} from './wallDownloads';

vi.mock('./wallUpload.js', () => ({
  uploadWallFile: vi.fn(),
  wallRequest: vi.fn()
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {
  let resolve!: (value: any) => void;
  let reject!: (reason: any) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe('transfers across app navigation', () => {
  let root: Root;
  let container: HTMLDivElement;
  let owner: string;
  const onPublished = vi.fn();
  const headers = () => ({ 'X-Wall-Owner-Token': owner });
  beforeEach(async () => {
    vi.clearAllMocks();
    owner = 'original-owner';
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => `blob:preview-${Math.random()}`);
        static revokeObjectURL = vi.fn();
      }
    );
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(42);
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
      const element = create(tag, options);
      if (tag === 'video')
        queueMicrotask(() =>
          element.dispatchEvent(new Event('loadedmetadata'))
        );
      return element;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={['/wall']}>
          <WallTransfersProvider>
            <nav>
              <Link to="/games">Explore games</Link>
              <Link to="/wall">Open wall</Link>
            </nav>
            <Routes>
              <Route path="/games" element={<h1>Games page</h1>} />
              <Route
                path="/wall"
                element={
                  <WallComposerSlot
                    identity={{ author: 'Test author', authorAvatar: '' }}
                    apiBase=""
                    headers={headers}
                    onPublished={onPublished}
                    onNotice={() => {}}
                  />
                }
              />
            </Routes>
          </WallTransfersProvider>
        </MemoryRouter>
      )
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    for (const job of getWallDownloads()) dismissWallDownload(job.id);
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    expect(hasWallTransfers()).toBe(false);
  });
  async function click(label: string) {
    const element = [
      ...container.querySelectorAll<HTMLElement>('button, a')
    ].find((node) => node.textContent?.trim() === label);
    expect(element, label).toBeDefined();
    await act(async () => element!.click());
  }
  async function select(files: File[]) {
    await click('Video');
    const input = [
      ...container.querySelectorAll<HTMLInputElement>('input[type=file]')
    ].at(-1)!;
    Object.defineProperty(input, 'files', { value: files });
    await act(async () =>
      input.dispatchEvent(new Event('change', { bubbles: true }))
    );
    return input;
  }
  async function publish() {
    await act(async () =>
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );
  }
  async function expandTransfers() {
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('.wall-transfers-toggle')!
        .click()
    );
  }

  it('keeps the upload, original native picker and preview alive when the wall unmounts', async () => {
    const done = deferred();
    vi.mocked(uploadWallFile).mockImplementation((options: any) => {
      options.onProgress(5, 'uploading');
      return done.promise;
    });
    const file = new File(['ten-bytes!'], 'phone.mp4', { type: 'video/mp4' });
    const input = await select([file]);
    const preview = container.querySelector('video')!.src;
    await publish();
    const options = vi.mocked(uploadWallFile).mock.calls[0][0];
    expect(options.file).toBe(file);
    await click('Explore games');
    expect(container.querySelector('form')).toBeNull();
    expect(input.isConnected).toBe(true);
    expect(input.files![0]).toBe(file);
    expect(options.signal.aborted).toBe(false);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(preview);
    expect(hasWallTransfers()).toBe(true);
    await expandTransfers();
    expect(container.textContent).toContain('Uploading · 50%');
    await act(async () =>
      done.resolve({ post: { _id: 'published-in-background' } })
    );
    expect(container.querySelector('h1')?.textContent).toBe('Games page');
    expect(container.textContent).toContain('Your post is published.');
    expect(onPublished).not.toHaveBeenCalled(); // Never invoke a detached feed.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(preview);
    expect(hasWallTransfers()).toBe(false);
    await click('Open wall');
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.querySelector('.wall-media-tile')).toBeNull();
  });

  it('pauses and resumes from another page with the same File, session and owner', async () => {
    const done = deferred();
    vi.mocked(uploadWallFile)
      .mockImplementationOnce(
        (options: any) =>
          new Promise((_resolve, reject) => {
            options.onProgress(3, 'uploading');
            options.signal.addEventListener('abort', () =>
              reject(new DOMException('Paused', 'AbortError'))
            );
          })
      )
      .mockImplementationOnce(() => done.promise);
    const file = new File(['phone video'], 'phone.mp4', { type: 'video/mp4' });
    const input = await select([file]);
    await publish();
    await click('Explore games');
    await expandTransfers();
    await click('Pause');
    expect(container.textContent).toContain('Upload paused');
    expect(input.isConnected).toBe(true);
    expect(hasWallTransfers()).toBe(true);
    owner = 'different-account';
    await click('Resume upload');
    const [first, second] = vi
      .mocked(uploadWallFile)
      .mock.calls.map(([options]) => options);
    expect(second.file).toBe(first.file);
    expect(second.uploadId).toBe(first.uploadId);
    expect(second.headers).toEqual({ 'X-Wall-Owner-Token': 'original-owner' });
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);
    await act(async () => done.resolve({ post: { _id: 'resumed-post' } }));
    expect(container.textContent).toContain('Games page');
  });

  it('retains a draft and its original input when users leave before publishing', async () => {
    const input = await select([
      new File(['video'], 'draft.mp4', { type: 'video/mp4' })
    ]);
    await click('Explore games');
    expect(input.isConnected).toBe(true);
    expect(hasWallTransfers()).toBe(true);
    await click('Open wall');
    expect(container.querySelector('.wall-media-tile')?.textContent).toContain(
      'draft.mp4'
    );
    expect(container.querySelector('input[data-wall-picker]')).toBe(input);
    expect(uploadWallFile).not.toHaveBeenCalled();
  });

  it('only retries the remaining file after a partially published batch', async () => {
    vi.mocked(uploadWallFile)
      .mockResolvedValueOnce({ post: { _id: 'first-post' } })
      .mockRejectedValueOnce(new Error('Connection interrupted'))
      .mockResolvedValueOnce({ post: { _id: 'second-post' } });
    const one = new File(['first'], 'one.mp4', { type: 'video/mp4' });
    const two = new File(['second'], 'two.mp4', { type: 'video/mp4' });
    const input = await select([one, two]);
    await publish();
    expect(onPublished).toHaveBeenCalledTimes(1);
    await click('Explore games');
    expect(input.isConnected).toBe(true);
    await expandTransfers();
    await click('Resume upload');
    expect(
      vi.mocked(uploadWallFile).mock.calls.map(([args]) => args.file)
    ).toEqual([one, two, two]);
    expect(vi.mocked(uploadWallFile).mock.calls[1][0].uploadId).toBe(
      vi.mocked(uploadWallFile).mock.calls[2][0].uploadId
    );
    expect(container.textContent).toContain('Your post is published.');
  });

  it('keeps download preparation visible after navigating away and hands off without replacing the app', async () => {
    const pending = deferred();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise)
    );
    const native = vi.fn((_args, callback) => callback(true));
    (window as any).Telegram = { WebApp: { downloadFile: native } };
    await act(async () => {
      startWallDownload({
        url: '/source.mp4',
        name: 'clip.mp4',
        grant: { url: '/api/post/download', headers: {}, quality: '360p' }
      });
    });
    await click('Explore games');
    expect(container.textContent).toContain('Preparing download');
    await act(async () =>
      pending.resolve({
        ok: true,
        json: async () => ({
          downloadUrl: '/signed/video',
          name: 'clip-360p.mp4'
        })
      })
    );
    expect(native).toHaveBeenCalledWith(
      {
        url: 'https://tonplaygram-bot.onrender.com/signed/video',
        file_name: 'clip-360p.mp4'
      },
      expect.any(Function)
    );
    expect(container.textContent).toContain('Sent to device');
    expect(container.textContent).toContain('Games page');
    delete (window as any).Telegram;
  });
});
