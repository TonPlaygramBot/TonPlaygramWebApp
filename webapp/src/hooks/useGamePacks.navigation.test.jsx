import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useGamePacks from './useGamePacks.js';
import { reconcileGamePackInstallations } from '../pwa/gamePackManager.js';
import { GAME_PACK_COMPLETE_PATH } from '../pwa/gamePackCatalog.js';

const catalog = vi.hoisted(() => ({ value: { packs: [] } }));
vi.mock('../pwa/gamePackCatalog.js', async importOriginal => ({
  ...await importOriginal(),
  loadGamePackCatalog: vi.fn(async () => catalog.value)
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PACK_ID = 'tonplaygram-app';
const CACHE_NAME = 'tonplaygram-pack-tonplaygram-app-reconciliation-test';
const STATE_KEY = 'tonplaygram-game-pack-installs-v1';
const HASH = 'a'.repeat(64);

// Exercise the real hook and reconciler with a full-size receipt. Count cache
// lookups rather than asserting wall time, which differs on phones and CI.
function savedDownload(assetCount = 2467) {
  const assets = Array.from({ length: assetCount }, (_, index) => ({
    url: `/assets/saved-${index}.glb`, size: 6, sha256: HASH
  }));
  const fixture = {
    receipt: { version: 'reconciliation-test', build: 'test-build', assets },
    present: true,
    markerPresent: true,
    missing: new Set(),
    reads: { receipt: 0, assets: 0 }
  };
  const pack = {
    id: PACK_ID,
    version: 'reconciliation-test',
    assetCount,
    totalBytes: 6 * assetCount,
    dependencies: []
  };
  catalog.value = { packs: [pack] };
  localStorage.setItem(STATE_KEY, JSON.stringify({
    schemaVersion: 1,
    packs: {
      [PACK_ID]: {
        ...pack, status: 'installed', cacheName: CACHE_NAME,
        updatedAt: '2026-09-14T00:00:00.000Z'
      }
    }
  }));
  const pathname = request => new URL(
    typeof request === 'string' ? request : request.url,
    window.location.origin
  ).pathname;
  const cache = {
    match: async request => {
      const key = pathname(request);
      if (key === GAME_PACK_COMPLETE_PATH) {
        fixture.reads.receipt++;
        return fixture.markerPresent ? Response.json(fixture.receipt) : undefined;
      }
      fixture.reads.assets++;
      if (fixture.missing.has(key)) return undefined;
      return new Response('cached', {
        headers: { 'X-TonPlaygram-Asset-Sha256': HASH }
      });
    },
    delete: async request => {
      if (pathname(request) === GAME_PACK_COMPLETE_PATH) fixture.markerPresent = false;
      return true;
    }
  };
  vi.stubGlobal('caches', {
    keys: async () => fixture.present ? [CACHE_NAME] : [],
    has: async name => fixture.present && name === CACHE_NAME,
    open: async () => cache
  });
  return fixture;
}

describe('download reconciliation during startup', () => {
  let root;
  let container;
  let downloads;

  function HomeDownloads() {
    downloads = useGamePacks();
    return <output>{downloads.installations[PACK_ID]?.status}:{String(downloads.loading)}</output>;
  }

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    window.history.replaceState({}, '', '/');
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('opens Home and reconnects without reading 2,467 individual files', async () => {
    const fixture = savedDownload();
    await act(async () => root.render(<HomeDownloads />));
    expect(container.textContent).toBe('installed:false');
    expect(fixture.reads).toEqual({ receipt: 1, assets: 0 });

    await act(async () => window.dispatchEvent(new Event('online')));
    expect(container.textContent).toBe('installed:false');
    expect(fixture.reads).toEqual({ receipt: 2, assets: 0 });
  });

  it('Check for updates audits every file and detects a later individual eviction', async () => {
    const fixture = savedDownload();
    await act(async () => root.render(<HomeDownloads />));
    await act(async () => downloads.refresh({ forceCatalog: true }));
    expect(fixture.reads.assets).toBe(2467);
    expect(container.textContent).toBe('installed:false');

    fixture.missing.add('/assets/saved-0.glb');
    await act(async () => downloads.refresh({ forceCatalog: true }));
    expect(container.textContent).toBe('partial:false');
    expect(fixture.markerPresent).toBe(false);
  });

  it('keeps the default reconciliation comprehensive for install and recovery callers', async () => {
    const fixture = savedDownload();
    fixture.missing.add('/assets/saved-2466.glb');
    const installations = await reconcileGamePackInstallations();
    expect(fixture.reads.assets).toBe(2467);
    expect(installations[PACK_ID].status).toBe('partial');
    expect(fixture.markerPresent).toBe(false);
  });

  it('enters a required game route with only its completed-download receipt check', async () => {
    const fixture = savedDownload();
    vi.stubEnv('VITE_REQUIRE_GAME_PACKS', 'true');
    window.history.replaceState({}, '', '/games/tiranastreets?activity=street-career');
    const { enforceRequiredGamePackRoute } = await import('../pwa/gamePackRouteGuard.js');
    expect(await enforceRequiredGamePackRoute()).toBe(false);
    expect(fixture.reads).toEqual({ receipt: 1, assets: 0 });
  });

  it.each([
    ['missing cache', fixture => { fixture.present = false; }],
    ['missing receipt', fixture => { fixture.markerPresent = false; }],
    ['null receipt', fixture => { fixture.receipt = null; }],
    ['wrong version', fixture => { fixture.receipt.version = 'other'; }],
    ['wrong count', fixture => { fixture.receipt.assets.pop(); }],
    ['invalid asset', fixture => { fixture.receipt.assets[0] = null; }]
  ])('does not report installed after a quick check finds a %s', async (_, invalidate) => {
    const fixture = savedDownload();
    invalidate(fixture);
    const installations = await reconcileGamePackInstallations({ verifyAssets: false });
    expect(installations[PACK_ID].status).toBe('partial');
    expect(fixture.reads.assets).toBe(0);
  });
});
