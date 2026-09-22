import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import WallComposer from './WallComposer';
import { uploadWallFile } from './wallUpload.js';
import {
  getWallUploads,
  dismissWallUpload,
  enqueueWallUploads
} from './wallUploadQueue.js';
vi.mock('./wallUpload.js', () => ({
  uploadWallFile: vi.fn(),
  wallRequest: vi.fn()
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
describe('composer to saved upload queue', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = () => 'blob:preview';
        static revokeObjectURL = vi.fn();
      }
    );
    vi.mocked(uploadWallFile).mockResolvedValue({ post: { _id: 'posted' } });
  });
  afterEach(async () => {
    await act(async () => {
      for (const job of getWallUploads()) await dismissWallUpload(job.id);
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('queues 30 original picker files with free defaults, captures ownership, and clears the composer', async () => {
    const notice = vi.fn();
    await act(async () =>
      root.render(
        <WallComposer
          apiBase="https://api.example"
          headers={() => ({ 'X-Wall-Owner-Token': 'owner' })}
          identity={{ author: 'Me', authorAvatar: '' }}
          onPublished={vi.fn()}
          onNotice={notice}
        />
      )
    );
    const video = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button')
    ).find((button) => button.textContent?.trim() === 'Video')!;
    await act(async () => video.click());
    const files = Array.from(
      { length: 30 },
      (_, index) =>
        new File(['video'], `video-${index}.mp4`, { type: 'video/mp4' })
    );
    const picker =
      container.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(picker, 'files', {
      configurable: true,
      value: files
    });
    await act(async () =>
      picker.dispatchEvent(new Event('change', { bubbles: true }))
    );
    expect(container.querySelectorAll('.wall-media-tile')).toHaveLength(30);
    await act(async () =>
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );
    await act(async () => {
      await vi.waitFor(() => expect(uploadWallFile).toHaveBeenCalledTimes(30));
    });
    const first = vi.mocked(uploadWallFile).mock.calls[0][0];
    expect(first.file).toBe(files[0]);
    expect(first).toMatchObject({
      premium: false,
      priceTpg: 0,
      headers: { 'X-Wall-Owner-Token': 'owner' }
    });
    expect(notice).toHaveBeenCalledWith(
      '30 files queued. Up to five upload at a time.'
    );
    expect(container.querySelectorAll('.wall-media-tile')).toHaveLength(0);
    await act(async () => {
      await vi.waitFor(() =>
        expect(getWallUploads().every((job) => job.status === 'complete')).toBe(
          true
        )
      );
    });
  });
  it('keeps the original File usable when persistent file storage exceeds quota', async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(
      function (value, key) {
        if (this.name === 'files')
          throw new DOMException('Full', 'QuotaExceededError');
        return put.call(this, value, key);
      }
    );
    const file = new File(['video'], 'quota.mp4', { type: 'video/mp4' });
    const result = await enqueueWallUploads(
      [{ id: 'quota', file, type: file.type }],
      {
        headers: { owner: 'same' },
        baseUrl: 'https://api.example',
        premium: false
      }
    );
    expect(result.persistent).toBe(false);
    await vi.waitFor(() => expect(uploadWallFile).toHaveBeenCalled());
    expect(vi.mocked(uploadWallFile).mock.calls[0][0].file).toBe(file);
    await vi.waitFor(() =>
      expect(getWallUploads().find((job) => job.id === 'quota')?.status).toBe(
        'complete'
      )
    );
  });
});
