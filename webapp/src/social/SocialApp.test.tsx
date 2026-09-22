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
vi.mock('../features/creator/CreatorStudio', () => ({ default: ({ active, onBroadcastStateChange }: any) => <div data-studio-active={active}><label>Draft caption<input defaultValue="" /></label><button onClick={() => onBroadcastStateChange('active')}>Start test broadcast</button></div> }));
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
  expect(container.querySelector('a[href="/social-app/creator-studio"]')).not.toBeNull();
});
it('opens the existing user profile from its own app route', async () => {
  await render('/social-app/me');
  expect(container.textContent).toContain('Shared profile');
});
it('keeps the Studio composer mounted when navigating to the wall and back', async () => {
  await render('/social-app/creator-studio');
  const input = container.querySelector<HTMLInputElement>('input')!;
  input.value = 'My pending post';
  await act(async () => container.querySelector<HTMLButtonElement>('[data-studio-active] button')!.click());
  await act(async () => container.querySelector<HTMLAnchorElement>('nav a[href="/social-app/wall"]')!.click());
  expect(input.isConnected).toBe(true);
  expect(container.querySelector('.social-broadcast')?.textContent).toContain('Your live broadcast is still running.');
  expect(input.closest('[hidden]')).not.toBeNull();
  expect(container.querySelector('[data-studio-active="false"]')).not.toBeNull();
});
it('offers installation with clear browser steps and a main-platform account link', async () => {
  await render('/social-app/install');
  expect(container.textContent).toContain('Install Social');
  expect(container.textContent).toContain('Safari');
  expect(container.querySelector('a[href="/account"]')).not.toBeNull();
});
