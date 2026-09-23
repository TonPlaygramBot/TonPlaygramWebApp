import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { SocialShell } from './SocialApp';
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('@tonconnect/ui-react', () => ({ TonConnectUIProvider: ({ children }: any) => children }));
vi.mock('../hooks/useTelegramAuth.js', () => ({ default: () => {} }));
vi.mock('../pages/Social.jsx', () => ({ default: () => <p>Shared chats and friends</p> }));
let root: Root, container: HTMLDivElement;
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (path: string) => {
  await act(async () => { root.render(<MemoryRouter basename="/social-app" initialEntries={[path]}><SocialShell /></MemoryRouter>); });
  // Lazy modules resolve on the next task even when mocked.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
};
it('opens the social hub without loading removed features', async () => {
  const path = '/social-app/';
  await render(path);
  expect(container.textContent).toContain('Shared chats and friends');
  const hrefs = [...container.querySelectorAll('nav a')].map(a => a.getAttribute('href'));
  expect(hrefs).toEqual(['/social-app/hub', '/social-app/me']);
  expect(container.querySelector('a[href*="/wall"]')).toBeNull();
  expect(container.querySelector('video')).toBeNull();
});
it('opens main account settings without requesting a wall profile', async () => {
  await render('/social-app/me');
  expect(container.textContent).toContain('Your TonPlayGram account');
  expect(container.querySelector('a[href="/account"]')).not.toBeNull();
});
it('offers installation with clear browser steps and a main-platform account link', async () => {
  await render('/social-app/install');
  expect(container.textContent).toContain('Install Social');
  expect(container.textContent).toContain('Safari');
  expect(container.querySelector('a[href="/account"]')).not.toBeNull();
});
