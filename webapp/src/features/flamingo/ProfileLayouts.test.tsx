import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import SocialProfilePage from './SocialProfilePage';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('./WallTransfers', () => ({ WallComposerSlot: () => null }));
vi.mock('./WallNotifications', () => ({ default: () => null }));
vi.mock('./WallFollowButton', () => ({ default: () => null }));
vi.mock('./WallProfileEditor', () => ({ default: () => null }));
vi.mock('./wallFollowing', () => ({ useWallFollowing: () => ({ accountId: 'reader', following: [] }) }));
vi.mock('./WallVideo', () => ({ default: () => <div data-full-video-player />, WallVideoDownload: () => null, lockWallVideoScroll: () => () => {} }));
let root: Root, container: HTMLDivElement;
const posts = [
  { id: '123456789012345678901234', author: 'Ada', authorAccountId: 'ada', text: 'A video from today', createdAt: '2026-09-22', attachment: { type: 'video/mp4', url: '/clip.mp4', size: 100, name: 'clip.mp4' } },
  { id: '123456789012345678901235', author: 'Ada', authorAccountId: 'ada', text: 'A photo from today', createdAt: '2026-09-22', attachment: { type: 'image/jpeg', url: '/photo.jpg', size: 100, name: 'photo.jpg' } },
  { id: '123456789012345678901236', author: 'Ada', authorAccountId: 'ada', text: 'A story from today', title: 'My story', createdAt: '2026-09-22' }
];
beforeEach(() => {
  localStorage.clear();
  URL.revokeObjectURL = vi.fn();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.stubGlobal('EventSource', class { addEventListener() {} close() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async url => ({ ok: true, json: async () => String(url).includes('/profiles/')
    ? { profile: { accountId: 'ada', name: 'Ada', avatar: '', bio: 'My profile', followers: 3, following: 2, postCount: 3, mediaCount: 2 } }
    : String(url).includes('/posts?') ? { posts, hasMore: false } : { author: 'Reader', authorAvatar: '' } })));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const render = () => act(async () => root.render(<MemoryRouter basename="/social-app" initialEntries={['/social-app/wall/profile/ada']}><Routes><Route path="/wall/profile/:accountId" element={<SocialProfilePage />} /></Routes></MemoryRouter>));
it('offers four layouts, defaults to three columns and preserves the fetched posts when switching', async () => {
  await render();
  expect(container.querySelectorAll('.wall-profile-layouts button')).toHaveLength(4);
  expect(container.querySelector('.wall-profile-grid')?.getAttribute('data-columns')).toBe('3');
  expect(container.querySelectorAll('.wall-profile-tile')).toHaveLength(3);
  expect(container.querySelector('[data-full-video-player]')).toBeNull();
  const requests = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/posts?')).length;
  for (const count of [4, 2, 1]) {
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${count} ${count === 1 ? 'column' : 'columns'}"]`)!.click());
    expect(container.querySelector(`[aria-label="${count} ${count === 1 ? 'column' : 'columns'}"]`)?.getAttribute('aria-pressed')).toBe('true');
  }
  expect(container.querySelectorAll('.fr-social-post')).toHaveLength(3);
  expect(container.querySelector('[data-full-video-player]')).not.toBeNull();
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/posts?'))).toHaveLength(requests);
  expect(localStorage.getItem('tonplaygram-profile-columns')).toBe('1');
});
it('restores the saved layout and opens tiles inside the same app', async () => {
  localStorage.setItem('tonplaygram-profile-columns', '4');
  await render();
  expect(container.querySelector('.wall-profile-grid')?.getAttribute('data-columns')).toBe('4');
  expect(container.querySelector('.wall-profile-tile')?.getAttribute('href')).toBe('/social-app/wall#post-123456789012345678901234');
  expect(container.querySelector('[aria-label="Open post: My story"]')).not.toBeNull();
  expect(container.querySelector('video[autoplay], video[controls]')).toBeNull();
  await act(async () => container.querySelector<HTMLButtonElement>('.wall-feed-tabs button:nth-child(3)')!.click());
  expect(container.querySelectorAll('.wall-profile-tile')).toHaveLength(1);
  expect(container.querySelector('.wall-profile-tile')?.getAttribute('aria-label')).toContain('video');
});
it('ignores a corrupt preference instead of rendering an invalid grid', async () => {
  localStorage.setItem('tonplaygram-profile-columns', '12');
  await render();
  expect(container.querySelector('.wall-profile-grid')?.getAttribute('data-columns')).toBe('3');
});
