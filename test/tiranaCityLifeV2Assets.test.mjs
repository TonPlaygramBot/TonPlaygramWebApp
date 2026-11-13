import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CITYLIFE_V2_BASE, CITYLIFE_V2_IDS, CITYLIFE_V2_HAS_LODS, CITYLIFE_V2_REVIEW_ONLY, cityLifeV2AssetUrl} from '../webapp/src/games/tiranastreets/citylife/cityLifeV2Assets.mjs';
const lock = JSON.parse(await readFile(new URL('../assets-source/tirana-citylife-v2/asset-lock.json', import.meta.url), 'utf8'));
test('catalog matches all 11 exact V2 master IDs', () => {
  assert.equal(new Set(CITYLIFE_V2_IDS).size, 11);
  assert.deepEqual([...CITYLIFE_V2_IDS].sort(), lock.assets.map(a => a.id).sort());
  assert.equal(lock.assets.filter(a => a.kind === 'human').length, 9);
  assert.equal(lock.assets.filter(a => a.kind === 'vehicle').length, 2);
});
test('every model has a versioned V2 URL and a locked digest', () => {
  assert.equal(CITYLIFE_V2_BASE, lock.baseUrl);
  for (const a of lock.assets) {
    assert.equal(cityLifeV2AssetUrl(a.id), lock.baseUrl + a.file);
    assert.match(a.sha256, /^[a-f0-9]{64}$/);
    assert(a.bytes > 0 && Number.isSafeInteger(a.bytes));
  }
});
test('V1 LOD aliases, paths and unknown IDs are never silently accepted', () => {
  for (const id of ['civilian_student_lod1', '../v1/civilian_student', 'albanian_ambulance.glb', '', null])
    assert.throws(() => cityLifeV2AssetUrl(id), RangeError);
});
test('the latest revised ZIP is pinned, not the older V2 archive', () => {
  assert.equal(lock.archive.name, 'Tirana-CityLife-V2-Revised.zip');
  assert.equal(lock.archive.sha256, '6a6226f87b15efc25a2140515b4bda9396971309fce841f9e6f3f44d9a779038');
  assert.equal(lock.repository, 'TonPlaygramBot/TonPlaygramWebApp');
  assert.equal(lock.game, 'Tirana Streets');
});
test('high-detail masters remain review-only until crowd LODs are supplied', () => {
  assert.equal(CITYLIFE_V2_HAS_LODS, false);
  assert.equal(CITYLIFE_V2_REVIEW_ONLY, true);
  assert.equal(lock.newLodsIncluded, false);
  assert.equal(lock.runtimeActivated, false);
});
