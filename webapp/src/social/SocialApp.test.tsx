import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { SocialShell } from './SocialApp';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@tonconnect/ui-react', () => ({ TonConnectUIProvider: ({ children }: any) => children }));
vi.mock('../hooks/useTelegramAuth.js', () => ({ default: () => {} }));
vi.mock('../features/flamingo/WallTransfers', () => ({ WallTransfersProvider: ({ children }: any) => children }));
vi.mock('../features/flamingo/wallFollowing', () => ({ useWallFollowing: () => ({ accountId: 'my-account' }) }));
vi.mock('../features/flamingo/CommunityWallApp', () => ({ default: () => <p>Shared wall</p> }));
vi.mock('../features/flamingo/SocialProfilePage', () => ({ default: () => <p>Shared profile</p> }));
vi.mock('../pages/Social.jsx', () => ({ default: () => <p>Shared chats and friends</p> }));
let root: Root, container: HTMLDivElement;
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (path: string) => {
  await act(async () => { root.render(<MemoryRouter basename="/social-app" initialEntries={[path]}><SocialShell /></MemoryRouter>); });
  // Lazy modules resolve on the next task even when mocked.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
};
it('keeps wall, hub, profiles and installation links in the Social app', async () => {
  await render('/social-app/wall');
  expect(container.textContent).toContain('Shared wall');
  const hrefs = [...container.querySelectorAll('nav a')].map(a => a.getAttribute('href'));
  expect(hrefs).toEqual(['/social-app/wall', '/social-app/hub', '/social-app/wall#wall-composer', '/social-app/me']);
  await act(async () => container.querySelector<HTMLAnchorElement>('nav a[href="/social-app/hub"]')!.click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(container.textContent).toContain('Shared chats and friends');
  expect(container.querySelector('a[href="/social-app/creator-studio"]')).toBeNull();
});
it('opens the existing user profile from its own app route', async () => {
  await render('/social-app/me');
  expect(container.textContent).toContain('Shared profile');
});
it('redirects the removed Creator Studio route to the social wall', async () => {
  await render('/social-app/creator-studio');
  expect(container.textContent).toContain('Shared wall');
});
it('offers installation with clear browser steps and a main-platform account link', async () => {
  await render('/social-app/install');
  expect(container.textContent).toContain('Install Social');
  expect(container.textContent).toContain('Safari');
  expect(container.querySelector('a[href="/account"]')).not.toBeNull();
});
