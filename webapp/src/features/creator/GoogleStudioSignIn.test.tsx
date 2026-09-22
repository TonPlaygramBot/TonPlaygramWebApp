import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GoogleStudioSignIn from './GoogleStudioSignIn';
import { creatorApi } from './api';

vi.mock('./api', () => ({ creatorApi: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const api = vi.mocked(creatorApi), authenticated = vi.fn(), onError = vi.fn();
let root: Root, node: HTMLDivElement, initialize: any, renderButton: any;
beforeEach(() => {
  vi.clearAllMocks();
  initialize = vi.fn(); renderButton = vi.fn((target: HTMLElement) => { const button = document.createElement('button'); button.textContent = 'Continue with Google'; target.append(button); });
  (window as any).google = { accounts: { id: { initialize, renderButton } } };
  api.mockImplementation(async path => path === '/login/google/identity' ? { clientId: '123-test.apps.googleusercontent.com', nonce: 'server-bound-nonce' } : { signedIn: true, name: 'Verified Creator' });
  authenticated.mockResolvedValue(undefined);
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); delete (window as any).google; vi.useRealTimers(); });
async function mount() { await act(async () => root.render(<GoogleStudioSignIn onAuthenticated={authenticated} onError={onError} />)); }
it('uses the official Google button and passes its credential to server verification', async () => {
  await mount();
  expect(initialize).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'server-bound-nonce', client_id: '123-test.apps.googleusercontent.com', ux_mode: 'popup', auto_select: false }));
  expect(renderButton).toHaveBeenCalledOnce();
  expect(authenticated).not.toHaveBeenCalled();
  await act(async () => initialize.mock.calls[0][0].callback({ credential: 'signed-google-token' }));
  expect(api).toHaveBeenCalledWith('/session/google', 'POST', { credential: 'signed-google-token' });
  expect(authenticated).toHaveBeenCalledWith({ signedIn: true, name: 'Verified Creator' });
});
it('shows a retry after verification fails without accepting a decoded profile', async () => {
  await mount(); api.mockRejectedValueOnce(new Error('Google could not verify this sign-in.'));
  await act(async () => initialize.mock.calls[0][0].callback({ credential: 'untrusted-token' }));
  expect(authenticated).not.toHaveBeenCalled(); expect(onError).toHaveBeenCalledWith('Google could not verify this sign-in.');
  const retry = [...node.querySelectorAll('button')].find(b => b.textContent === 'Retry Google sign-in')!;
  await act(async () => retry.click());
  expect(api.mock.calls.filter(([p]) => p === '/login/google/identity')).toHaveLength(2);
});
it('stops waiting for blocked Google scripts and explains how to recover', async () => {
  vi.useFakeTimers(); delete (window as any).google;
  await mount(); await act(async () => { await vi.advanceTimersByTimeAsync(16000); });
  expect(node.textContent).toContain('Retry Google sign-in');
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('Chrome or Safari'));
  expect(authenticated).not.toHaveBeenCalled();
});
