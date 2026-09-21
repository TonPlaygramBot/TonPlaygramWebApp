import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import WallFollowButton from './WallFollowButton';
import WallNotifications from './WallNotifications';
import WallProfileEditor from './WallProfileEditor';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
describe('following and profile controls', () => {
  let root: Root, container: HTMLDivElement;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => ({
        ok: true,
        json: async () =>
          String(url).endsWith('/following')
            ? { accountId: 'reader', following: [] }
            : String(url).endsWith('/notifications')
              ? {
                  accountId: 'reader',
                  telegramAvailable: true,
                  telegramEnabled: false,
                  publicKey: 'test'
                }
              : init?.method === 'PATCH'
                ? { accountId: 'reader', author: 'Updated name' }
                : { enabled: true }
      }))
    );
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  const button = (text: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (item) => item.textContent?.includes(text)
    )!;
  it('uses a small plus control and offers both notification choices without prompting automatically', async () => {
    const permission = vi.fn();
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: permission
    });
    await act(async () =>
      root.render(
        <>
          <WallFollowButton compact accountId="creator" name="Creator" />
          <WallNotifications />
        </>
      )
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Follow Creator"]')!
        .click()
    );
    expect(
      document.querySelector('[role="dialog"][aria-label="Follow Creator"]')
    ).not.toBeNull();
    await act(async () => button('Every post').click());
    const save = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, init]) =>
          String(url).endsWith('/following/creator') && init?.method === 'PUT'
      );
    expect(JSON.parse(save![1]!.body as string)).toEqual({
      following: true,
      notify: true
    });
    expect(
      container.querySelector('[aria-label="Following Creator"]')
    ).not.toBeNull();
    expect(container.querySelector<HTMLSelectElement>('select')!.value).toBe(
      'following'
    );
    expect(permission).not.toHaveBeenCalled();
  });
  it('follows silently, then allows unfollowing', async () => {
    await act(async () =>
      root.render(<WallFollowButton accountId="creator" name="Creator" />)
    );
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Follow Creator"]')!
        .click()
    );
    await act(async () => button('No notifications').click());
    await act(async () =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Following Creator"]')!
        .click()
    );
    await act(async () => button('Unfollow').click());
    const saves = vi
      .mocked(fetch)
      .mock.calls.filter(([, init]) => init?.method === 'PUT')
      .map(([, init]) => JSON.parse(init!.body as string));
    expect(saves).toEqual([
      { following: true, notify: false },
      { following: false, notify: false }
    ]);
  });
  it('hides the follow button on the current user profile', async () => {
    await act(async () =>
      root.render(<WallFollowButton accountId="reader" name="Me" />)
    );
    expect(container.querySelector('button')).toBeNull();
  });
  it('saves a new username and refreshes visible profile identity', async () => {
    const saved = vi.fn(),
      refreshed = vi.fn();
    window.addEventListener('profilePhotoUpdated', refreshed);
    await act(async () =>
      root.render(<WallProfileEditor name="Old name" onSaved={saved} />)
    );
    await act(async () => button('Edit profile').click());
    const input = document.querySelector<HTMLInputElement>(
      '[aria-label="Profile username"]'
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )!.set!.call(input, 'Updated name');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () =>
      document
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    );
    const request = vi
      .mocked(fetch)
      .mock.calls.find(([, init]) => init?.method === 'PATCH');
    expect(JSON.parse(request![1]!.body as string)).toEqual({
      name: 'Updated name'
    });
    expect(saved).toHaveBeenCalledTimes(1);
    expect(refreshed).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    window.removeEventListener('profilePhotoUpdated', refreshed);
  });
});
