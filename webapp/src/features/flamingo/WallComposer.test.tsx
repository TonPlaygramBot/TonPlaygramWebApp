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
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:picker-preview');
      static revokeObjectURL = vi.fn();
    });
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(42);
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = createElement(tagName, options);
      if (tagName === 'video') {
        queueMicrotask(() => element.dispatchEvent(new Event('loadedmetadata')));
      }
      return element;
    });
    vi.mocked(uploadWallFile).mockResolvedValue({ post: { _id: 'uploaded-post' } });
    vi.mocked(wallRequest).mockResolvedValue({ post: { _id: 'article-post' } });
    onPublished = vi.fn();
    onNotice = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(
      <WallComposer
        identity={{ author: 'Community member', authorAvatar: '' }}
        apiBase="https://tonplaygram-bot.onrender.com"
        headers={() => ({ 'X-Owner-Token': 'test-owner' })}
        onPublished={onPublished}
        onNotice={onNotice}
      />
    ));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function clickButton(text: string, within: Element = container) {
    const button = Array.from(within.querySelectorAll('button'))
      .find((candidate) => candidate.textContent?.trim() === text);
    expect(button).toBeDefined();
    await act(async () => button!.click());
  }

  async function chooseFile(file: File) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async function fill(selector: string, value: string) {
    const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    expect(input).not.toBeNull();
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    await act(async () => {
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  async function publish() {
    await act(async () => container.querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  }

  it.each(['video/mp4', '', 'application/octet-stream'])(
    'preserves a picker MP4 with MIME "%s" and resolves video metadata separately',
    async (type) => {
      const file = new File(['phone video bytes'], '1000006764.mp4', { type });
      await clickButton('Video');
      await chooseFile(file);

      expect(container.querySelector('.wall-media-tile video')).not.toBeNull();
      expect(container.querySelector('.wall-premium summary')?.textContent)
        .toBe('Download settings');
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
    vi.mocked(uploadWallFile).mockRejectedValueOnce(new Error('Connection interrupted.'));
    await clickButton('Video');
    await chooseFile(file);
    await publish();

    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('Connection interrupted.');
    expect(container.querySelector('.wall-media-tile video')).not.toBeNull();
    await publish();

    const [first, second] = vi.mocked(uploadWallFile).mock.calls.map(([request]) => request);
    expect(first.file).toBe(file);
    expect(second.file).toBe(file);
    expect(second.uploadId).toBe(first.uploadId);
    expect(onPublished).toHaveBeenCalledTimes(1);
  });

  it('retains article title, body, cover photo and premium download options', async () => {
    const file = new File(['cover photo bytes'], 'cover.png', { type: '' });
    await clickButton('Photo');
    await chooseFile(file);
    await clickButton('Article', container.querySelector('.wall-compose-tabs')!);
    expect(container.querySelector('.wall-media-tile img')?.getAttribute('alt')).toBe('cover.png');
    expect(container.querySelector('.wall-add-media')?.textContent).toBe('Cover photo');
    await fill('input[placeholder="Give your story a headline"]', 'Community story');
    await fill('textarea', 'The full article is still supported.');
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
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
    await clickButton('Article', container.querySelector('.wall-compose-shortcuts')!);
    await fill('input[placeholder="Give your story a headline"]', 'Text article');
    await fill('textarea', 'An article does not require a cover photo.');
    await publish();

    expect(uploadWallFile).not.toHaveBeenCalled();
    expect(wallRequest).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(wallRequest).mock.calls[0];
    expect(url).toBe('https://tonplaygram-bot.onrender.com/api/flamingo-wall/posts/content');
    expect(JSON.parse(init!.body as string)).toMatchObject({
      title: 'Text article',
      text: 'An article does not require a cover photo.'
    });
    expect(onPublished).toHaveBeenCalledWith({ _id: 'article-post' });
  });
});
