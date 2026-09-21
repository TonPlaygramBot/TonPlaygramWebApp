import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import CommunityWallApp from './CommunityWallApp';
import { WallTransfersProvider } from './WallTransfers';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const id = '000000000000000000000001';
const post = {
  _id: id,
  author: 'Alice Reader',
  authorAccountId: 'alice',
  authorAvatar: '/api/flamingo-wall/profiles/alice/avatar',
  text: 'A community video',
  createdAt: new Date().toISOString(),
  attachment: {
    name: 'clip.mp4',
    type: 'video/mp4',
    size: 1000,
    url: '/original.mp4'
  }
};
describe('complete wall rendering', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal(
      'URL',
      Object.assign(class extends URL {}, {
        createObjectURL: vi.fn(() => 'blob:preview'),
        revokeObjectURL: vi.fn()
      })
    );
    vi.stubGlobal(
      'EventSource',
      class {
        addEventListener() {}
        close() {}
      }
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input) => {
        const url = String(input);
        let body: any = {};
        if (url.includes('/identity'))
          body = {
            author: 'Signed-in Reader',
            authorAvatar: '/reader.jpg',
            accountId: 'reader'
          };
        else if (url.includes('/video-qualities'))
          body = {
            qualities: [
              {
                quality: 'original',
                status: 'ready',
                label: 'Original',
                url: '/original.mp4'
              },
              {
                quality: '480p',
                status: 'ready',
                label: '480p',
                url: '/480p.mp4'
              }
            ]
          };
        else if (url.endsWith(`/posts/${id}`)) body = { post };
        else if (url.includes('/posts?'))
          body = { posts: [post], hasMore: false };
        else if (url.includes('/notifications'))
          body = {
            publicKey: 'key',
            accountId: 'reader',
            telegramAvailable: true,
            telegramEnabled: false
          };
        return { ok: true, json: async () => body } as Response;
      })
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const render = async (path = '/wall') => {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <WallTransfersProvider>
            <CommunityWallApp />
          </WallTransfersProvider>
        </MemoryRouter>
      )
    );
  };
  it('renders the real author photo/name, composer identity, default 480p, and notification control together', async () => {
    await render();
    expect(container.querySelector('.fr-author-link strong')?.textContent).toBe(
      'Alice Reader'
    );
    expect(
      container.querySelector('.fr-author-avatar')?.getAttribute('src')
    ).toContain('/api/flamingo-wall/profiles/alice/avatar');
    expect(container.querySelector('video')?.getAttribute('src')).toContain(
      '/480p.mp4'
    );
    expect(container.textContent).not.toContain('Community member');
    expect(container.textContent).toContain('Share something, Signed-in');
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Wall notifications"]')!
        .click()
    );
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(
      'Wall notifications'
    );
  });
  it('loads a notification-linked post even when it is outside the newest feed page', async () => {
    const normalFetch = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) =>
      String(input).includes('/posts?')
        ? ({
            ok: true,
            json: async () => ({ posts: [], hasMore: false })
          } as Response)
        : normalFetch(input, init)
    );
    await render(`/wall#post-${id}`);
    expect(container.querySelector(`#post-${id}`)?.textContent).toContain(
      'A community video'
    );
  });
});
