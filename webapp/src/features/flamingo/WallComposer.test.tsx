import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WallComposer from './WallComposer';
import { uploadWallFile, wallRequest } from './wallUpload.js';

vi.mock('./wallUpload.js', () => ({
  uploadWallFile: vi.fn(),
  wallRequest: vi.fn()
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('wall composer picker files', () => {
  let root: Root;
  let container: HTMLDivElement;
  let onPublished: ReturnType<typeof vi.fn>;
  let onNotice: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = vi.fn(() => 'blob:picker-preview');
        static revokeObjectURL = vi.fn();
      }
    );
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(42);
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName, options) => {
        const element = createElement(tagName, options);
        if (tagName === 'video') {
          queueMicrotask(() =>
            element.dispatchEvent(new Event('loadedmetadata'))
          );
        }
        return element;
      }
    );
    vi.mocked(uploadWallFile).mockResolvedValue({
      post: { _id: 'uploaded-post' }
    });
    vi.mocked(wallRequest).mockResolvedValue({ post: { _id: 'article-post' } });
    onPublished = vi.fn();
    onNotice = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <WallComposer
          identity={{ author: 'Community member', authorAvatar: '' }}
          apiBase="https://tonplaygram-bot.onrender.com"
          headers={() => ({ 'X-Owner-Token': 'test-owner' })}
          onPublished={onPublished}
          onNotice={onNotice}
        />
      )
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function clickButton(text: string, within: Element = container) {
    const button = Array.from(within.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === text
    );
    expect(button).toBeDefined();
    await act(async () => button!.click());
  }

  async function chooseFiles(files: File[]) {
    const input = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="file"]')
    ).at(-1)!;
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    await act(async () =>
      input.dispatchEvent(new Event('change', { bubbles: true }))
    );
    return input;
  }
  const chooseFile = (file: File) => chooseFiles([file]);

  async function fill(selector: string, value: string) {
    const input = container.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >(selector)!;
    expect(input).not.toBeNull();
    const prototype =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(
        input,
        value
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function publish() {
    await act(async () =>
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );
  }

  it.each(['video/mp4', '', 'application/octet-stream'])(
    'preserves a picker MP4 with MIME "%s" and resolves video metadata separately',
    async (type) => {
      const file = new File(['phone video bytes'], '1000006764.mp4', { type });
      await clickButton('Video');
      await chooseFile(file);

      expect(container.querySelector('.wall-media-tile video')).not.toBeNull();
      expect(
        container.querySelector('.wall-premium summary')?.textContent
      ).toBe('Download settings');
      expect(URL.createObjectURL).toHaveBeenCalledWith(file);
      await publish();

      expect(uploadWallFile).toHaveBeenCalledTimes(1);
      const request = vi.mocked(uploadWallFile).mock.calls[0][0];
      expect(request.file).toBe(file);
      expect(request.type).toBe('video/mp4');
      expect(request.duration).toBe(42);
      expect(request.file.type).toBe(type);
      expect(wallRequest).not.toHaveBeenCalled();
      expect(onPublished).toHaveBeenCalledWith({ _id: 'uploaded-post' });
    }
  );

  it('keeps the same picker file and upload ID when publication is retried', async () => {
    const file = new File(['phone video bytes'], 'retry.mp4', { type: '' });
    vi.mocked(uploadWallFile).mockRejectedValueOnce(
      new Error('Connection interrupted.')
    );
    await clickButton('Video');
    await chooseFile(file);
    await publish();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Connection interrupted.'
    );
    expect(container.querySelector('.wall-media-tile video')).not.toBeNull();
    await publish();

    const [first, second] = vi
      .mocked(uploadWallFile)
      .mock.calls.map(([request]) => request);
    expect(first.file).toBe(file);
    expect(second.file).toBe(file);
    expect(second.uploadId).toBe(first.uploadId);
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('retains the native selection through preview and retry, releasing it after publication', async () => {
    await clickButton('Video');
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const clear = vi.fn();
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => 'C:\\fakepath\\phone.mp4',
      set: clear
    });
    const file = new File(['phone video'], 'phone.mp4', { type: 'video/mp4' });
    await chooseFile(file);
    expect(input.isConnected).toBe(true);
    expect(input.files?.[0]).toBe(file);
    expect(clear).not.toHaveBeenCalled();
    vi.mocked(uploadWallFile).mockRejectedValueOnce(
      new Error('Connection interrupted.')
    );
    await publish();
    expect(input.isConnected).toBe(true);
    expect(input.files?.[0]).toBe(file);
    expect(clear).not.toHaveBeenCalled();
    await publish();
    expect(input.isConnected).toBe(false);
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });

  it('publishes the selected File through the real uploader and native FileReader fallback', async () => {
    const actual =
      await vi.importActual<typeof import('./wallUpload.js')>(
        './wallUpload.js'
      );
    const source = 'selected phone bytes';
    const file = new File([source], 'phone.mp4', { type: 'video/mp4' });
    // JSDOM provides the File/FileReader API without Blob.arrayBuffer. Exercise
    // that compatibility path using its real reader, with only HTTP stubbed.
    expect(typeof file.slice(0, 4).arrayBuffer).toBe('undefined');
    const ranges: { offset: number; bytes: Uint8Array }[] = [];
    vi.mocked(uploadWallFile).mockImplementation((args) =>
      actual.uploadWallFile({
        ...args,
        send: async (url, init) => {
          if (url.endsWith('/uploads'))
            return { uploadId: args.uploadId, chunkBytes: 4 };
          if (init?.method === 'PUT') {
            const bytes = new Uint8Array(init.body as ArrayBuffer);
            expect(bytes.byteLength).toBeLessThanOrEqual(4);
            ranges.push({
              offset: Number(init.headers['X-Upload-Offset']),
              bytes
            });
            return {};
          }
          return { post: { _id: 'reader-post' } };
        }
      })
    );
    await clickButton('Video');
    await chooseFile(file);
    await publish();
    await act(async () => {
      await vi.waitFor(() =>
        expect(onPublished).toHaveBeenCalledWith({ _id: 'reader-post' })
      );
    });
    const received = new Uint8Array(source.length);
    ranges.forEach(({ offset, bytes }) => received.set(bytes, offset));
    expect(new TextDecoder().decode(received)).toBe(source);
    expect(onPublished).toHaveBeenCalledWith({ _id: 'reader-post' });
  });

  it('keeps separate picker batches alive until each batch has no selected files', async () => {
    await clickButton('Video');
    const first = new File(['first'], 'first.mp4', { type: 'video/mp4' });
    const second = new File(['second'], 'second.mp4', { type: 'video/mp4' });
    const third = new File(['third'], 'third.mp4', { type: 'video/mp4' });
    const firstPicker = await chooseFiles([first, second]);
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Remove first.mp4"]')!
        .click()
    );
    expect(firstPicker.isConnected).toBe(true);
    const secondPicker = await chooseFile(third);
    expect(secondPicker).not.toBe(firstPicker);
    expect(firstPicker.files?.[1]).toBe(second);
    expect(secondPicker.files?.[0]).toBe(third);
    vi.mocked(uploadWallFile).mockImplementation(async ({ file }) => {
      expect(
        file === second ? firstPicker.isConnected : secondPicker.isConnected
      ).toBe(true);
      return { post: { _id: file.name } };
    });
    await publish();
    expect(
      vi.mocked(uploadWallFile).mock.calls.map(([request]) => request.file)
    ).toEqual([second, third]);
    expect(firstPicker.isConnected).toBe(false);
    expect(secondPicker.isConnected).toBe(false);
  });

  it('replaces an unreadable file through the general picker without losing the caption or premium settings', async () => {
    const original = new File(['unreadable'], 'gallery.mp4', {
      type: 'video/mp4'
    });
    await clickButton('Video');
    const originalPicker = await chooseFile(original);
    await fill('textarea', 'Keep my caption');
    await act(async () =>
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click()
    );
    await fill('input[type="number"]', '25');
    vi.mocked(uploadWallFile).mockRejectedValueOnce(
      Object.assign(new Error('This file could not be read.'), {
        code: 'WALL_FILE_UNREADABLE'
      })
    );
    await publish();
    await clickButton('Choose from Files');
    const picker = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[type="file"]')
    ).at(-1)!;
    expect(picker.accept).toBe('*/*');
    expect(picker.multiple).toBe(false);
    // Cancelling the alternative picker must preserve the existing selection.
    await chooseFiles([]);
    expect(originalPicker.isConnected).toBe(true);
    expect(
      container.querySelector('.wall-media-tile strong')?.textContent
    ).toBe('gallery.mp4');
    const replacement = new File(['readable copy'], 'saved.mp4', {
      type: 'video/mp4'
    });
    await chooseFile(replacement);
    expect(originalPicker.isConnected).toBe(false);
    expect(container.querySelectorAll('.wall-media-tile')).toHaveLength(1);
    await publish();
    const [failed, replaced] = vi
      .mocked(uploadWallFile)
      .mock.calls.map(([request]) => request);
    expect(replaced.file).toBe(replacement);
    expect(replaced.uploadId).not.toBe(failed.uploadId);
    expect(replaced).toMatchObject({
      text: 'Keep my caption',
      premium: true,
      priceTpg: 25
    });
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('validates a replacement article cover before releasing the original picker', async () => {
    await clickButton('Photo');
    const cover = new File(['cover'], 'cover.png', { type: 'image/png' });
    const originalPicker = await chooseFile(cover);
    await clickButton(
      'Article',
      container.querySelector('.wall-compose-tabs')!
    );
    await fill('input[placeholder="Give your story a headline"]', 'Keep title');
    await fill('textarea', 'Keep article');
    vi.mocked(uploadWallFile).mockRejectedValueOnce(
      Object.assign(new Error('This file could not be read.'), {
        code: 'WALL_FILE_UNREADABLE'
      })
    );
    await publish();
    await clickButton('Choose from Files');
    await chooseFile(new File(['video'], 'wrong.mp4', { type: 'video/mp4' }));
    expect(originalPicker.isConnected).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Choose one photo'
    );
    expect(
      container.querySelector('.wall-media-tile strong')?.textContent
    ).toBe('cover.png');
    await clickButton('Choose from Files');
    await chooseFile(
      new File(['new cover'], 'copy.png', { type: 'image/png' })
    );
    await publish();
    expect(vi.mocked(uploadWallFile).mock.calls[1][0]).toMatchObject({
      title: 'Keep title',
      text: 'Keep article',
      type: 'image/png'
    });
  });

  it('replaces a failed video in order without republishing a completed video', async () => {
    const first = new File(['first'], 'first.mp4', { type: 'video/mp4' });
    const failed = new File(['failed'], 'failed.mp4', { type: 'video/mp4' });
    const third = new File(['third'], 'third.mp4', { type: 'video/mp4' });
    await clickButton('Video');
    const originalPicker = await chooseFiles([first, failed, third]);
    vi.mocked(uploadWallFile)
      .mockResolvedValueOnce({ post: { _id: 'first-post' } })
      .mockRejectedValueOnce(
        Object.assign(new Error('This file could not be read.'), {
          code: 'WALL_FILE_UNREADABLE'
        })
      );
    await publish();
    expect(onPublished).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.wall-media-tile')).toHaveLength(2);
    await clickButton('Choose from Files');
    const replacement = new File(['copy'], 'copy.mp4', { type: 'video/mp4' });
    await chooseFile(replacement);
    expect(originalPicker.isConnected).toBe(true);
    expect(
      Array.from(container.querySelectorAll('.wall-media-tile strong')).map(
        (item) => item.textContent
      )
    ).toEqual(['copy.mp4', 'third.mp4']);
    await publish();
    expect(
      vi.mocked(uploadWallFile).mock.calls.map(([request]) => request.file)
    ).toEqual([first, failed, replacement, third]);
    expect(onPublished).toHaveBeenCalledTimes(3);
    expect(originalPicker.isConnected).toBe(false);
  });

  it('retains article title, body, cover photo and premium download options', async () => {
    const file = new File(['cover photo bytes'], 'cover.png', { type: '' });
    await clickButton('Photo');
    await chooseFile(file);
    await clickButton(
      'Article',
      container.querySelector('.wall-compose-tabs')!
    );
    expect(
      container.querySelector('.wall-media-tile img')?.getAttribute('alt')
    ).toBe('cover.png');
    expect(container.querySelector('.wall-add-media')?.textContent).toBe(
      'Cover photo'
    );
    await fill(
      'input[placeholder="Give your story a headline"]',
      'Community story'
    );
    await fill('textarea', 'The full article is still supported.');
    await act(async () =>
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click()
    );
    await fill('input[type="number"]', '25');
    await publish();

    expect(uploadWallFile).toHaveBeenCalledTimes(1);
    const request = vi.mocked(uploadWallFile).mock.calls[0][0];
    expect(request.file).toBe(file);
    expect(request).toMatchObject({
      type: 'image/png',
      title: 'Community story',
      text: 'The full article is still supported.',
      premium: true,
      priceTpg: 25
    });
    expect(onPublished).toHaveBeenCalledWith({ _id: 'uploaded-post' });
  });

  it('still publishes an article without an attachment through the content endpoint', async () => {
    await clickButton(
      'Article',
      container.querySelector('.wall-compose-shortcuts')!
    );
    await fill(
      'input[placeholder="Give your story a headline"]',
      'Text article'
    );
    await fill('textarea', 'An article does not require a cover photo.');
    await publish();

    expect(uploadWallFile).not.toHaveBeenCalled();
    expect(wallRequest).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(wallRequest).mock.calls[0];
    expect(url).toBe(
      'https://tonplaygram-bot.onrender.com/api/flamingo-wall/posts/content'
    );
    expect(JSON.parse(init!.body as string)).toMatchObject({
      title: 'Text article',
      text: 'An article does not require a cover photo.'
    });
    expect(onPublished).toHaveBeenCalledWith({ _id: 'article-post' });
  });
});
