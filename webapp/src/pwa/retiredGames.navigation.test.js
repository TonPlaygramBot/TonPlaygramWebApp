import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import gamesCatalog, { inviteGamesCatalog } from '../config/gamesCatalog.js';
import { GAME_PACK_DEFINITIONS } from './gamePackDefinitions.js';
import { generateGamePackManifests } from '../../scripts/generate-game-pack-manifests.mjs';

const retiredSlugs = ['tiranastreets', 'jetskiroyal', 'blackwater'];

afterEach(() => {
  vi.unstubAllEnvs();
  window.history.replaceState({}, '', '/');
});

describe('retired games and the retained Racing city', () => {
  it('does not offer removed games in games, invitations or downloads', () => {
    for (const catalog of [gamesCatalog, inviteGamesCatalog]) {
      expect(catalog.some(game => retiredSlugs.includes(game.slug))).toBe(false);
      expect(catalog.some(game => game.slug === 'kartroyale')).toBe(true);
    }
    expect(GAME_PACK_DEFINITIONS.some(pack => ['tirana-streets', 'jetski-royal'].includes(pack.id))).toBe(false);
    expect(GAME_PACK_DEFINITIONS.some(pack => pack.gameSlugs.some(slug => retiredSlugs.includes(slug)))).toBe(false);
  });

  it('keeps all shared city asset groups reachable through the Racing download', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'racing-shared-city-'));
    const publicDir = path.join(directory, 'public');
    const outputDir = path.join(directory, 'packs');
    const files = [
      'assets/kart-royale/kart.glb',
      'assets/tirana-streets/environment/roadside-rail.glb',
      'assets/tirana-streets/vehicle-collection/sedan.glb',
      'assets/tirana-detail-kit/shop.glb',
      'assets/tirana-landmarks/building.glb',
      'assets/blackwater/ground.glb',
      'assets/tirana-streets/players/turi.glb',
      'models/murlan/avatar.glb'
    ];
    try {
      for (const file of files) {
        await mkdir(path.dirname(path.join(publicDir, file)), { recursive: true });
        await writeFile(path.join(publicDir, file), `fixture:${file}`);
      }
      const catalog = await generateGamePackManifests({ publicDir, outputDir });
      const packs = new Map(catalog.packs.map(pack => [pack.id, pack]));
      expect(packs.get('shared-tirana-city')).toMatchObject({ hidden: true, route: null, gameSlugs: [] });
      const downloaded = new Set();
      const visited = new Set();
      async function collect(id) {
        if (visited.has(id)) return;
        visited.add(id);
        const pack = packs.get(id);
        expect(pack, `Missing dependency ${id}`).toBeDefined();
        const manifest = JSON.parse(await readFile(path.join(outputDir, `${id}.json`), 'utf8'));
        manifest.assets.forEach(asset => downloaded.add(asset.url));
        for (const dependency of pack.dependencies) await collect(dependency);
      }
      await collect('racing-royal');
      expect([...downloaded].sort()).toEqual(files.map(file => `/${file}`).sort());
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(retiredSlugs)('does not interrupt the %s redirect with a download prompt', async slug => {
    vi.stubEnv('VITE_REQUIRE_GAME_PACKS', 'true');
    vi.resetModules();
    const { enforceRequiredGamePackRoute } = await import('./gamePackRouteGuard.js');
    window.history.replaceState({}, '', `/games/${slug}/lobby?mode=online`);
    expect(await enforceRequiredGamePackRoute()).toBe(false);
    expect(window.location.pathname).toBe(`/games/${slug}/lobby`);
  });
});
