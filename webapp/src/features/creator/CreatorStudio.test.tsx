import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CreatorStudio from './CreatorStudio';
import { creatorApi, openCreatorAuthorization } from './api';
vi.mock('./api', () => ({ creatorApi: vi.fn(), uploadMedia: vi.fn(), openCreatorAuthorization: vi.fn() }));
vi.mock('../../utils/api.js', () => ({ API_BASE_URL: 'https://studio.example' }));
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, node: HTMLDivElement;
const facebook = { id: 'facebook', name: 'Facebook', color: '#5599ff', post: ['text', 'image/jpeg'], live: true, limit: 63206, available: true, note: 'Pages' };
const account = { id: '111111111111111111111111', platform: 'facebook', name: 'My Page', status: 'connected' };
const api = vi.mocked(creatorApi);
function button(text: string) { return [...node.querySelectorAll('button')].find(x => x.textContent?.trim() === text) as HTMLButtonElement; }
async function click(text: string) { await act(async () => button(text).click()); }
beforeEach(async () => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  api.mockImplementation(async (path, method, body: any) => {
    if (path === '/catalog') return { platforms: [facebook], googleLogin: true, liveEnabled: false };
    if (path === '/session') return { signedIn: true, name: 'Creator', method: 'google' };
    if (path === '/accounts') return { accounts: [account] };
    if (path === '/posts' && method !== 'POST') return { posts: [] };
    if (path === '/media') return { media: [] };
    if (path === '/live') return { live: null };
    if (path === '/posts' && method === 'POST') return { ...body, _id: '222222222222222222222222' };
    if (path.includes('/submit')) return { status: 'queued' };
    return {};
  });
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
  await act(async () => root.render(<MemoryRouter><CreatorStudio /></MemoryRouter>));
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.restoreAllMocks(); });
it('publishing needs destination, content and a final confirmation', async () => {
  expect(button('Publish').disabled).toBe(true); await click('My Page');
  const textarea = node.querySelector('textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'An original post'); textarea.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(button('Publish').disabled).toBe(false); await click('Publish');
  expect(node.querySelector('dialog')?.open).toBe(true);
  expect(api.mock.calls.some(([path]) => path.includes('/submit'))).toBe(false); await click('Confirm');
  expect(api.mock.calls.some(([path,method]) => path.includes('/submit') && method === 'POST')).toBe(true);
  expect(node.textContent).toContain('Post queued');
});
it('live stays disabled until the server is configured', async () => {
  await click('Go live'); expect(node.textContent).toContain('Live broadcasting is being prepared');
  expect((node.querySelector('.cs-go-live') as HTMLButtonElement).disabled).toBe(true);
});
it('disconnect is confirmed and scoped to the selected account', async () => {
  await click('Accounts'); await act(async () => (node.querySelector('[aria-label="Disconnect My Page"]') as HTMLButtonElement).click());
  expect(api.mock.calls.some(([,method]) => method === 'DELETE')).toBe(false); await click('Confirm');
  expect(api).toHaveBeenCalledWith(`/accounts/${account.id}`, 'DELETE');
});
it('API failures are visible and never become publishing success', async () => {
  api.mockImplementationOnce(async () => { throw new Error('Temporarily offline'); });
  await click('Activity'); await click('Refresh');
  expect(node.querySelector('[role="alert"]')?.textContent).toContain('Temporarily offline');
  expect(api.mock.calls.some(([path]) => path.includes('/submit'))).toBe(false);
});
it('keeps an existing broadcast visible across tabs and protects its sign-in session', async () => {
  const implementation = api.getMockImplementation()!;
  api.mockImplementation(async (path, method, body) => path === '/live' ? { live: { id: 'broadcast-one', destinations: [{ id: account.id, name: account.name, status: 'sending' }] } } : implementation(path, method, body));
  await act(async () => root.render(<MemoryRouter><CreatorStudio key="active-broadcast" /></MemoryRouter>));
  expect(node.querySelector('.cs-broadcast-banner')?.textContent).toContain('broadcast session is open');
  await click('Accounts');
  expect(button('Sign out').disabled).toBe(true);
  expect(button('Reconnect Facebook').disabled).toBe(true);
  expect(api.mock.calls.some(([path]) => path.includes('/stop'))).toBe(false);
  await click('Return to live studio');
  expect(node.querySelector('.cs-broadcast-banner')).toBe(null);
  expect(button('End broadcast everywhere')).toBeDefined();
  expect(api.mock.calls.some(([path]) => path.includes('/stop'))).toBe(false);
});

it('explains missing Google setup instead of offering a disabled sign-in button', async () => {
  const implementation = api.getMockImplementation()!;
  api.mockImplementation(async (path, method, body) => {
    if (path === '/catalog') return { platforms: [facebook], googleLogin: false, googleLoginReason: 'client_id', liveEnabled: false };
    if (path === '/session') return { signedIn: false };
    return implementation(path, method, body);
  });
  await act(async () => root.render(<MemoryRouter><CreatorStudio key="missing-google-config" /></MemoryRouter>));
  await click('Use an existing Google or Telegram Studio');
  expect(node.querySelector('.cs-signin [role="status"]')?.textContent).toContain('enabled by the app owner');
  expect(node.querySelector('.cs-signin')?.textContent).not.toContain('setup pending');
  expect(button('Continue with Google')).toBeUndefined();
});

it('guests connect through official authorization without signing into Google first', async () => {
  const implementation = api.getMockImplementation()!;
  api.mockImplementation(async (path, method, body) => {
    if (path === '/session') return { signedIn: false };
    if (path === '/accounts/facebook/connect') return { url: 'https://www.facebook.com/v25.0/dialog/oauth?state=bound' };
    return implementation(path, method, body);
  });
  await act(async () => root.render(<MemoryRouter><CreatorStudio key="guest-connect" /></MemoryRouter>));
  expect(button('Connect Facebook').disabled).toBe(false);
  expect(node.querySelector('input[type="password"]')).toBeNull();
  await click('Connect Facebook');
  expect(api).toHaveBeenCalledWith('/accounts/facebook/connect', 'POST', {});
  expect(openCreatorAuthorization).toHaveBeenCalledWith('https://www.facebook.com/v25.0/dialog/oauth?state=bound');
  expect(api.mock.calls.some(([p]) => p === '/login/google' || p === '/session/google')).toBe(false);
});
it('missing platform configuration cannot simulate a successful connection', async () => {
  const implementation = api.getMockImplementation()!;
  api.mockImplementation(async (path, method, body) => {
    if (path === '/catalog') return { platforms: [{ ...facebook, available: false }], googleLogin: false };
    if (path === '/session') return { signedIn: false };
    return implementation(path, method, body);
  });
  await act(async () => root.render(<MemoryRouter><CreatorStudio key="unavailable-provider" /></MemoryRouter>));
  expect(button('Connect Facebook').disabled).toBe(true);
  expect(node.textContent).toContain('TonPlayGram needs to enable this connection');
  expect(openCreatorAuthorization).not.toHaveBeenCalled();
});
