import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ConnectAccountButton, { checkedAuthorizationUrl } from './ConnectAccountButton';
import { creatorApi, openCreatorAuthorization } from './api';
vi.mock('./api', () => ({ creatorApi: vi.fn(), openCreatorAuthorization: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const platform = { id: 'facebook', name: 'Facebook', color: '#5599ff', post: ['text'], live: true, limit: 63206, available: false, note: 'Pages' };
const url = 'https://www.facebook.com/v25.0/dialog/oauth?state=bound';
const api = vi.mocked(creatorApi), navigate = vi.mocked(openCreatorAuthorization);
let root: Root, node: HTMLDivElement;
let busy: ReturnType<typeof vi.fn>;
const render = (active = true) => act(async () => { root.render(<ConnectAccountButton platform={platform} reconnect={false} disabled={false} active={active} onBusyChange={busy} />); });
const button = () => node.querySelector('button')!;
beforeEach(async () => {
  vi.resetAllMocks(); busy = vi.fn();
  history.replaceState({}, '', '/creator-studio');
  node = document.createElement('div'); document.body.append(node); root = createRoot(node);
  await render();
});
afterEach(async () => { await act(async () => root.unmount()); node.remove(); vi.useRealTimers(); });

it('offers a real official Continue link if the browser blocks automatic navigation', async () => {
  api.mockResolvedValue({ url }); navigate.mockImplementation(() => { throw new Error('Navigation blocked'); });
  await act(async () => button().click());
  expect(navigate).toHaveBeenCalledWith(url);
  expect(node.querySelector('a')?.getAttribute('href')).toBe(url);
  expect(node.querySelector('[role="status"]')?.textContent).toContain('Tap Continue below');
  expect(button().disabled).toBe(false); expect(busy).toHaveBeenLastCalledWith(false);
});
it('times out a stalled request, blocks duplicate taps and allows retry', async () => {
  vi.useFakeTimers();
  api.mockImplementationOnce((_path, _method, _body, _headers, signal) => new Promise((_resolve, reject) => {
    signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  await act(async () => { button().click(); button().click(); });
  expect(api).toHaveBeenCalledTimes(1); expect(button().disabled).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(node.querySelector('[role="alert"]')?.textContent).toContain('timed out');
  expect(button().disabled).toBe(false); expect(navigate).not.toHaveBeenCalled();
  api.mockResolvedValueOnce({ url });
  await act(async () => button().click());
  expect(navigate).toHaveBeenCalledWith(url); expect(busy).toHaveBeenLastCalledWith(false);
});
it('shows network failures beside the button and never claims the account is connected', async () => {
  api.mockRejectedValue(new TypeError('Failed to fetch'));
  await act(async () => button().click());
  expect(node.querySelector('[role="alert"]')?.textContent).toContain('Could not reach TonPlayGram');
  expect(button().disabled).toBe(false); expect(node.querySelector('a')).toBeNull(); expect(navigate).not.toHaveBeenCalled();
});
it.each(['hide', 'unmount'])('cancels pending navigation when the Studio is hidden or left: %s', async action => {
  let resolve!: (value: { url: string }) => void;
  api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await act(async () => button().click());
  const signal = api.mock.calls[0][4]!;
  if (action === 'hide') await render(false);
  else await act(async () => root.render(null));
  expect(signal.aborted).toBe(true); expect(busy).toHaveBeenLastCalledWith(false);
  await act(async () => resolve({ url }));
  expect(navigate).not.toHaveBeenCalled();
  await render(true); expect(button().disabled).toBe(false);
});
it('rejects unexpected destinations before automatic navigation or a fallback link', async () => {
  for (const invalid of ['https://www.facebook.com.evil.example/', 'https://accounts.google.com/', 'http://www.facebook.com/', 'javascript:alert(1)', 'https://user@www.facebook.com/', undefined]) {
    api.mockResolvedValueOnce({ url: invalid });
    await act(async () => button().click());
    expect(node.querySelector('[role="alert"]')?.textContent).toContain('could not be verified');
    expect(node.querySelector('a')).toBeNull();
  }
  expect(navigate).not.toHaveBeenCalled();
  for (const [platform, host] of Object.entries({ youtube: 'accounts.google.com', facebook: 'www.facebook.com', instagram: 'www.instagram.com', tiktok: 'www.tiktok.com' })) {
    expect(checkedAuthorizationUrl(`https://${host}/authorize?state=bound`, platform)).toBe(`https://${host}/authorize?state=bound`);
  }
});
