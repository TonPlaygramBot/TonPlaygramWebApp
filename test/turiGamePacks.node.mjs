import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import gamesCatalog from '../webapp/src/config/gamesCatalog.js';
import { GAME_PACK_DEFINITIONS, generateGamePackManifests } from '../webapp/scripts/generate-game-pack-manifests.mjs';
import { TURI_MODEL_URL } from '../webapp/src/config/playerCharacter.js';

test('every Games page entry downloads Turi without depending on the Tirana city', () => {
  const definitions = new Map(GAME_PACK_DEFINITIONS.map(pack => [pack.id, pack]));
  function dependencies(id, visited = new Set()) {
    assert.ok(definitions.has(id), `Unknown pack ${id}`);
    if (visited.has(id)) return visited;
    visited.add(id);
    for (const dependency of definitions.get(id).dependencies || []) dependencies(dependency, visited);
    return visited;
  }
  for (const game of gamesCatalog) {
    const pack = GAME_PACK_DEFINITIONS.find(pack => pack.gameSlugs.includes(game.slug));
    assert.ok(pack, game.name);
    const included = dependencies(pack.id);
    assert.ok(included.has('shared-player-character'), `${game.name} must include Turi`);
    if (game.slug !== 'tiranastreets') assert.ok(!included.has('tirana-streets'), `${game.name} must not download the city for a character`);
  }
});

test('shared character manifest contains the real model and retains it in native builds', async t => {
  const outputDir = await mkdtemp(join(tmpdir(), 'turi-packs-'));
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  const definition = GAME_PACK_DEFINITIONS.find(pack => pack.id === 'shared-player-character');
  await generateGamePackManifests({ outputDir, definitions: [definition], cdnBaseUrl: 'https://cdn.example.com' });
  const manifest = JSON.parse(await readFile(join(outputDir, `${definition.id}.json`), 'utf8'));
  const model = manifest.assets.find(asset => asset.url === TURI_MODEL_URL);
  assert.ok(model, 'actual model was packaged');
  assert.ok(model.size > 1_000_000);
  assert.equal(model.sha256.length, 64);
  assert.equal(model.sourceUrl, TURI_MODEL_URL);
  assert.equal(model.nativeRemovable, false);
});
