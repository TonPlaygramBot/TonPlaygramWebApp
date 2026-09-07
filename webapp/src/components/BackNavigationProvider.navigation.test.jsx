import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BackNavigationProvider from './BackNavigationProvider.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { dispatchAppBack, handleNativeBack } from '../utils/backNavigation.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('phone and Telegram Back navigation', () => {
  let root;
  let container;
  let navigate;
  let button;
  let events;
  let exitGame;
  function Page() {
    navigate = useNavigate();
    const { pathname } = useLocation();
    useTelegramBackButton(pathname === '/games/poolroyale' ? exitGame : undefined);
    return <span>{pathname}</span>;
  }
  async function mount(path = '/') {
    window.history.replaceState({ idx: 0, key: 'initial' }, '', path);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<React.StrictMode><BrowserRouter><BackNavigationProvider><Page /></BackNavigationProvider></BrowserRouter></React.StrictMode>));
  }
  async function back(callback = dispatchAppBack) {
    await act(async () => { callback(); await new Promise((resolve) => setTimeout(resolve, 30)); });
  }
  beforeEach(() => {
    events = new Set();
    button = { show: vi.fn(), hide: vi.fn() };
    exitGame = vi.fn();
    window.Telegram = { WebApp: { BackButton: button, onEvent: (_name, fn) => events.add(fn), offEvent: (_name, fn) => events.delete(fn) } };
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    expect(events.size).toBe(0);
    expect(dispatchAppBack()).toBeUndefined();
  });
  it('returns to the previous page including its query and hash with one listener under StrictMode', async () => {
    await mount('/wall?filter=videos#post-99');
    await act(async () => navigate('/wall/profile/author'));
    expect(events.size).toBe(1);
    await back(() => [...events][0]());
    expect(`${location.pathname}${location.search}${location.hash}`).toBe('/wall?filter=videos#post-99');
  });
  it('works on pages without a page-specific Back hook and stops at the root', async () => {
    await mount();
    await act(async () => navigate('/earn'));
    await back();
    expect(location.pathname).toBe('/');
    expect(dispatchAppBack()).toBe(false);
    expect(button.hide).toHaveBeenCalled();
  });
  it('uses an app fallback for a direct link instead of leaving for external browser history', async () => {
    await mount('/wall/profile/author');
    await back();
    expect(location.pathname).toBe('/wall');
    await back();
    expect(location.pathname).toBe('/');
  });
  it('treats Telegram launch parameters at home as the app root', async () => {
    await mount('/?startapp=account#tgWebAppVersion=8.0');
    expect(dispatchAppBack()).toBe(false);
    expect(button.hide).toHaveBeenCalled();
  });
  it('calls a game exit confirmation once and removes it when the route changes', async () => {
    await mount('/games/poolroyale');
    await back();
    expect(exitGame).toHaveBeenCalledTimes(1);
    expect(location.pathname).toBe('/games/poolroyale');
    await act(async () => navigate('/wall'));
    await back();
    expect(exitGame).toHaveBeenCalledTimes(1);
    expect(location.pathname).toBe('/games/poolroyale');
  });
  it('honors Android canGoBack before React mounts even without Telegram listeners', () => {
    const history = { back: vi.fn() };
    const exit = vi.fn();
    handleNativeBack({ canGoBack: true, appResult: undefined, notifyListeners: () => false, history, exit });
    expect(history.back).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
  });
  it('does not double-handle a native event, and exits only at the app root', () => {
    const history = { back: vi.fn() };
    const exit = vi.fn();
    const notifyListeners = vi.fn();
    handleNativeBack({ canGoBack: true, appResult: true, notifyListeners, history, exit });
    expect(notifyListeners).not.toHaveBeenCalled();
    expect(history.back).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    handleNativeBack({ canGoBack: true, appResult: false, notifyListeners, history, exit });
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
