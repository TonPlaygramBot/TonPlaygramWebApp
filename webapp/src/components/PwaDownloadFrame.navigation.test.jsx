import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PwaDownloadFrame from './PwaDownloadFrame.jsx';

const mocks = vi.hoisted(() => ({ app: {}, install: {} }));
vi.mock('../hooks/useAppDownload.js', () => ({ default: () => mocks.app }));
vi.mock('../hooks/usePwaInstallPrompt.js', () => ({ default: () => mocks.install }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('whole-app download on Home', () => {
  let root;
  let container;
  const button = text => [...container.querySelectorAll('button')].find(item => item.textContent.includes(text));
  const render = async path => {
    if (path) window.history.replaceState({}, '', path);
    await act(async () => root.render(<BrowserRouter><PwaDownloadFrame /></BrowserRouter>));
  };
  beforeEach(() => {
    mocks.app = {
      pack: { totalBytes: 1024, assetCount: 4 }, status: 'not-installed', progress: null,
      storage: { usage: 0, quota: 4096, persisted: false }, loading: false, error: '', supported: true,
      download: vi.fn(), cancel: vi.fn(), refresh: vi.fn(), remove: vi.fn()
    };
    mocks.install = {
      installed: false, installPending: false, canPrompt: true, telegramDetected: false,
      requestInstall: vi.fn().mockResolvedValue({ outcome: 'accepted' }),
      installationGuidance: 'Open the browser menu and choose Add to Home Screen.', openExternalInstall: vi.fn()
    };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    window.history.replaceState({}, '', '/');
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('requests installation from the click and downloads without waiting for the install prompt', async () => {
    const calls = [];
    mocks.install.requestInstall.mockImplementation(() => { calls.push('install'); return new Promise(() => {}); });
    mocks.app.download.mockImplementation(() => calls.push('download'));
    await render();
    await act(async () => button('Download TonPlayGram').click());
    expect(calls).toEqual(['install', 'download']);
    expect(container.textContent).toContain('Home Screen installation not confirmed');
    expect(container.textContent).not.toContain('All app files saved');
  });

  it('keeps Add to Home Screen available after files finish downloading', async () => {
    mocks.app.status = 'installed';
    mocks.install.canPrompt = false;
    await render('/?returnTo=%2Fgames%2Fpoolroyale%2Flobby#app-download');
    expect(container.textContent).toContain('All app files saved');
    expect(button('Add to Home Screen')).toBeDefined();
    expect(container.textContent).toContain(mocks.install.installationGuidance);
    expect(container.querySelector('a').getAttribute('href')).toBe('/games/poolroyale/lobby');
  });

  it('shows real progress and can pause, then resume the same download', async () => {
    mocks.app.status = 'downloading';
    mocks.app.progress = { percent: 50, completedAssets: 2, totalAssets: 4, downloadedBytes: 256, reusedBytes: 256, totalBytes: 1024 };
    await render();
    expect(container.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('50');
    expect(container.textContent).toContain('2 of 4 files saved');
    expect(container.textContent).toContain('512 B of 1.0 KB');
    await act(async () => button('Pause download').click());
    expect(mocks.app.cancel).toHaveBeenCalledTimes(1);
    mocks.app.status = 'partial';
    await render();
    await act(async () => button('Resume download').click());
    expect(mocks.app.download).toHaveBeenCalledTimes(1);
  });

  it('shows a failed download as retryable without claiming completion', async () => {
    mocks.app.status = 'partial';
    mocks.app.error = 'Connection lost. Your saved files are ready to resume.';
    await render();
    expect(container.querySelector('[role="alert"]').textContent).toContain('Connection lost');
    expect(button('Retry download').disabled).toBe(false);
    expect(container.textContent).not.toContain('All app files saved');
  });

  it('surfaces worker startup failures and allows retry from the same card', async () => {
    mocks.app.download.mockRejectedValueOnce(new Error('App storage is still starting. Reload and try again.'));
    await render();
    await act(async () => button('Download TonPlayGram').click());
    expect(container.querySelector('[role="alert"]').textContent).toContain('App storage is still starting');
    await act(async () => button('Retry download').click());
    expect(mocks.app.download).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps confirmed Home Screen installation separate from missing app files', async () => {
    mocks.install.installed = true;
    await render();
    expect(container.textContent).toContain('Added to Home Screen');
    expect(container.textContent).toContain('App files not downloaded');
    await act(async () => button('Download TonPlayGram').click());
    expect(mocks.install.requestInstall).not.toHaveBeenCalled();
    expect(mocks.app.download).toHaveBeenCalledTimes(1);
  });

  it('does not offer a download without storage support or follow external return URLs', async () => {
    mocks.app.supported = false;
    await render();
    expect(button('Download TonPlayGram').disabled).toBe(true);
    mocks.app.status = 'installed';
    await render('/?returnTo=https%3A%2F%2Fexample.com');
    expect(container.querySelector('a').getAttribute('href')).toBe('/games');
  });
});
