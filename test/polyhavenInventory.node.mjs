import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildPolyhavenInventory,
  filterPolyhavenMetadata,
  resolvePolyhavenMetadata
} from '../webapp/scripts/external-assets/polyhaven-inventory.mjs';

const root = 'https://dl.polyhaven.org/file/ph-assets';
const texture = (asset, suffix, extension = 'jpg', directory = 'Textures') =>
  `${root}/${directory}/${extension}/1k/${asset}/${asset}_${suffix}_1k.${extension}`;
const entry = url => ({ size: 100, url });
const group = (assetId, channel, candidates, extra = {}) => ({
  id: `polyhaven:texture:${assetId}:1k:${channel}`, kind: 'texture', assetId,
  resolution: '1k', channel, essential: true, candidates, aliases: [], ...extra
});
const resolve = (groups, metadata) => resolvePolyhavenMetadata(
  { groupIds: groups.map(item => item.id) }, metadata, groups
);

test('exact declared color variant and format wins over API traversal order', () => {
  const asset = 'fabric_pattern_07';
  const primary = texture(asset, 'col_1');
  const other = texture(asset, 'col_2');
  const alpha = texture(asset, 'col_1', 'png');
  const guessed = texture(asset, 'diff');
  const result = resolve([group(asset, 'diffuse', [primary, guessed])], {
    col_2: { '1k': { jpg: entry(other) } },
    col_1: { '1k': { png: entry(alpha), jpg: entry(primary) } }
  });
  assert.deepEqual(result.groups[0].candidates, [primary]);
  assert.deepEqual(result.groups[0].aliases, [guessed]);
  assert.equal(result.body.col_2, undefined);
  assert.equal(result.body.col_1['1k'].png, undefined);
  assert.equal(result.body.col_1['1k'].jpg.url, primary);
});

test('explicit PNG and JPEG files remain independent requirements', () => {
  const jpg = texture('fabric_pattern_07', 'col_1');
  const png = texture('fabric_pattern_07', 'col_1', 'png');
  const result = resolve([group('fabric_pattern_07', 'diffuse', [png, jpg])], {
    col_1: { '1k': { jpg: entry(jpg), png: entry(png) } }
  });
  assert.deepEqual(result.groups.map(item => item.candidates), [[png], [jpg]]);
  assert.deepEqual(result.groups.map(item => item.aliases), [[], []]);
  assert.equal(new Set(result.groups.map(item => item.id)).size, 2);
});

test('plant parts and formats are not aliases; glTF sidecars stay independent', () => {
  const asset = 'potted_plant_02';
  const leaves = texture(asset, 'leaves_diff', 'jpg', 'Models');
  const pot = texture(asset, 'pot_diff', 'jpg', 'Models');
  const leavesAlpha = texture(asset, 'leaves_diff', 'png', 'Models');
  const model = `${root}/Models/gltf/1k/${asset}/${asset}_1k.gltf`;
  const buffer = `${root}/Models/gltf/1k/${asset}/${asset}.bin`;
  const result = resolve([
    group(asset, 'diffuse', [leaves]),
    { id: 'plant-model', kind: 'model', resolution: '1k', candidates: [model], aliases: [] }
  ], {
    pot_diff: { '1k': { jpg: entry(pot) } },
    leaves_diff: { '1k': { png: entry(leavesAlpha), jpg: entry(leaves) } },
    gltf: { '1k': { gltf: { url: model, include: {
      'plant.bin': entry(buffer), 'pot.jpg': entry(pot), 'leaves.png': entry(leavesAlpha)
    } } } }
  });
  assert.deepEqual(result.groups[0].candidates, [leaves]);
  assert.deepEqual(result.groups[0].aliases, []);
  assert.deepEqual(result.dependencies.map(item => item.url).sort(), [buffer, pot, leavesAlpha].sort());
  assert.equal(result.body.gltf['1k'].gltf.include['leaves.png'].url, leavesAlpha);
  const pruned = filterPolyhavenMetadata(result.body, new Set([leaves, model, buffer, pot]));
  assert.equal(pruned.gltf['1k'].gltf.include['leaves.png'], undefined);
});

test('metadata-only plant picker prefers JPG but never aliases another part', () => {
  const asset = 'potted_plant_02';
  const guessed = texture(asset, 'rough');
  const potPng = texture(asset, 'pot_rough', 'png', 'Models');
  const leavesJpg = texture(asset, 'leaves_rough', 'jpg', 'Models');
  const potJpg = texture(asset, 'pot_rough', 'jpg', 'Models');
  const result = resolve([group(asset, 'roughness', [guessed])], {
    pot_rough: { '1k': { png: entry(potPng) } },
    leaves_rough: { '1k': { jpg: entry(leavesJpg) } },
    other_pot: { '1k': { jpg: entry(potJpg) } }
  });
  assert.deepEqual(result.groups[0].candidates, [leavesJpg]);
  assert.deepEqual(result.groups[0].aliases, [guessed]);
});

test('glTF include keys alias exact canonical texture and shared-resolution buffer files', () => {
  const model = `${root}/Models/gltf/1k/ArmChair_01/ArmChair_01_1k.gltf`;
  const diffuse = `${root}/Models/jpg/1k/ArmChair_01/Armchair_01_diff_1k.jpg`;
  const buffer = `${root}/Models/gltf/4k/ArmChair_01/ArmChair_01.bin`;
  const result = resolve([
    { id: 'armchair-model', kind: 'model', resolution: '1k', candidates: [model], aliases: [] }
  ], { gltf: { '1k': { gltf: { url: model, include: {
    'textures/Armchair_01_diff_1k.jpg': entry(diffuse),
    'ArmChair_01.bin': entry(buffer)
  } } } } });
  assert.deepEqual(result.dependencies.find(item => item.url === diffuse).aliases, [
    `${root}/Models/gltf/1k/ArmChair_01/textures/Armchair_01_diff_1k.jpg`
  ]);
  assert.deepEqual(result.dependencies.find(item => item.url === buffer).aliases, [
    `${root}/Models/gltf/1k/ArmChair_01/ArmChair_01.bin`
  ]);
});

test('declared texture material glTFs receive the same metadata dependency aliases as models', async () => {
  const inventory = await buildPolyhavenInventory();
  const ids = ['denim_fabric', 'fabric_pattern_07', 'floral_jacquard', 'gingham_check', 'hessian_230', 'knitted_fleece'];
  for (const asset of ids) {
    const material = inventory.groups.find(item => item.id === `polyhaven:material:${asset}:1k`);
    assert.ok(material);
    const request = inventory.metadataRequests.find(item => item.groupIds.includes(material.id));
    assert.ok(request, 'material glTF must participate in API include discovery');
    const diffuse = texture(asset, 'diff');
    const buffer = `${root}/Textures/gltf/8k/${asset}/${asset}.bin`;
    const result = resolvePolyhavenMetadata(request, {
      gltf: { '1k': { gltf: { url: material.candidates[0], include: {
        [`textures/${asset}_diff_1k.jpg`]: entry(diffuse),
        [`${asset}.bin`]: entry(buffer)
      } } } }
    }, inventory.groups);
    assert.deepEqual(result.dependencies.find(item => item.url === diffuse).aliases, [
      `${root}/Textures/gltf/1k/${asset}/textures/${asset}_diff_1k.jpg`
    ]);
    assert.deepEqual(result.dependencies.find(item => item.url === buffer).aliases, [
      `${root}/Textures/gltf/1k/${asset}/${asset}.bin`
    ]);
  }
});

test('red leather inventory chooses the default glTF coll1 variant at every resolution', async () => {
  const inventory = await buildPolyhavenInventory();
  for (const asset of ['leather_red_02', 'leather_red_03']) {
    const groups = inventory.groups.filter(item => item.assetId === asset && item.channel === 'diffuse');
    assert.equal(groups.length, 4);
    for (const item of groups) {
      const chosen = item.candidates[0];
      assert.ok(chosen.endsWith(`/${asset}_coll1_${item.resolution}.jpg`));
      const alternate = chosen.replace('_coll1_', '_coll2_');
      const result = resolve([item], {
        coll2: { [item.resolution]: { jpg: entry(alternate) } },
        coll1: { [item.resolution]: { jpg: entry(chosen) } }
      });
      assert.deepEqual(result.groups[0].candidates, [chosen]);
      assert.ok(!result.groups[0].aliases.includes(alternate));
    }
  }
});

test('all 63 standalone Domino thumbnail query URLs are distinct from shared thumbnails', async () => {
  const inventory = await buildPolyhavenInventory();
  const groups = inventory.groups.filter(item => item.kind === 'thumbnail' && item.candidates[0].includes('width=512'));
  assert.equal(groups.length, 63);
  assert.ok(groups.every(item => item.essential && item.candidates[0].endsWith('?width=512&height=512')));
  for (const id of ['ArmChair_01', 'BarberShopChair_01', 'GreenChair_01', 'SchoolChair_01', 'CoffeeTable_01']) {
    assert.ok(groups.some(item => item.candidates[0].includes(`/thumbs/${id}.png?`)));
  }
  for (const [canonical, original] of [['countrytrax_midday', 'country_track_midday'], ['rosewood_veneer1', 'rosewood_veneer_01']]) {
    const item = groups.find(candidate => candidate.assetId === canonical);
    assert.ok(item.aliases.some(url => url.endsWith(`/${original}.png?width=512&height=512`)));
    assert.ok(!item.aliases.some(url => url.includes('width=256')));
  }
});

test('unused Snake thumbnails are skipped, but a referenced catalog is inventoried', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tonplaygram-inventory-'));
  try {
    await mkdir(path.join(directory, 'src/pages/Games'), { recursive: true });
    await mkdir(path.join(directory, 'public'));
    const filename = path.join(directory, 'src/pages/Games/SnakeAndLadder.jsx');
    const source = `const FLOOR_TEXTURE_OPTIONS = Object.freeze([\n  { thumbnail: polyHavenThumb('unused_floor_fixture') }\n]);\n`;
    await writeFile(filename, source);
    let inventory = await buildPolyhavenInventory({ webappDir: directory });
    assert.ok(!inventory.groups.some(item => item.assetId === 'unused_floor_fixture'));
    await writeFile(filename, `${source}\nrender(FLOOR_TEXTURE_OPTIONS);\n`);
    inventory = await buildPolyhavenInventory({ webappDir: directory });
    assert.ok(inventory.groups.some(item => item.assetId === 'unused_floor_fixture'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
