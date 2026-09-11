import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FORCE_ASSETS, forceDispatch, forceVehicleFor, forceCharacterFor} from '../webapp/src/games/tiranastreets/shared/albanianForces.mjs';
import {createState, stepState, publicState} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
const base = new URL('../webapp/public/assets/tirana-streets/albanian-forces/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', base)));

test('all 14 force assets are self-contained GLBs with intact rigs and pivots', () => {
  assert.equal(FORCE_ASSETS.length, 14);
  assert.equal(new Set(FORCE_ASSETS.map(a => a.id)).size, 14);
  for (const a of FORCE_ASSETS) {
    const b = readFileSync(new URL(`glb/${a.id}.glb`, base));
    assert.equal(b.readUInt32LE(0), 0x46546c67, a.id);
    assert.equal(b.readUInt32LE(8), b.length, a.id);
    const n = b.readUInt32LE(12), doc = JSON.parse(b.subarray(20, 20 + n));
    const binaryLength = b.readUInt32LE(n + 20);
    for (const view of doc.bufferViews) assert.ok((view.byteOffset || 0) + view.byteLength <= binaryLength, a.id);
    assert.ok(doc.images.every(i => i.bufferView !== undefined && !i.uri), a.id);
    assert.ok(doc.buffers.every(b => !b.uri), a.id);
    const entry = manifest.find(m => m.id === a.id);
    assert.equal(entry.file, a.url);
    assert.equal(entry.bytes, b.length);
    assert.equal(entry.bytes, entry.sourceBytes, `${a.id}: keep the original file size`);
    assert.equal(entry.sha256, entry.sourceSha256, `${a.id}: no lossy asset processing`);
    assert.equal(entry.triangles, entry.sourceTriangles, `${a.id}: no mesh simplification`);
    assert.equal(entry.quality, 'original');
    assert.equal(entry.maxTextureSize, undefined, `${a.id}: no texture cap`);
    assert.equal(doc.asset.extras?.tiranaTextureMaxSize, undefined);
    assert.equal(doc.asset.extras?.tiranaGeometry, undefined);
    assert.equal(entry.sha256, createHash('sha256').update(b).digest('hex'));
    if (a.category === 'person') {
      assert.deepEqual(doc.animations.map(a => a.name).sort(), ['Idle', 'Walk']);
      assert.ok(doc.skins.length > 0 && doc.skins[0].joints.length >= 100);
    } else {
      assert.ok(doc.nodes.some(n => n.name?.startsWith('Wheel_')), a.id);
      assert.ok(doc.nodes.some(n => n.name?.startsWith('Steer_')), a.id);
    }
  }
});
test('dispatch roster reaches every supplied vehicle and character', () => {
  const used = new Set();
  for (let stars = 1; stars <= 5; stars++) for (let slot = 0; slot < 8; slot++) {
    const pair = forceDispatch(stars, slot);
    used.add(pair.forceVehicle); used.add(pair.forceCharacter);
    assert.equal(forceVehicleFor({model: 'police', ...pair}).category, 'vehicle');
    assert.equal(forceCharacterFor({kind: 'police', ...pair}).category, 'person');
  }
  assert.deepEqual([...used].sort(), FORCE_ASSETS.map(a => a.id).sort());
});
test('actual wanted responses retain matching uniforms through public snapshots', () => {
  for (let stars = 1; stars <= 5; stars++) {
    const state = createState([{id: 'p', name: 'Player'}], 'free-roam');
    const p = state.players.p; p.wanted = stars * 100; p.lastCrime = 0;
    state.nextDispatch = 0; stepState(state);
    assert.equal(state.units.length, 1);
    const snapshot = publicState(state), unit = snapshot.units[0];
    const officers = snapshot.npcs.filter(n => n.unit === unit.id);
    assert.ok(officers.length > 0);
    assert.equal(unit.forceVehicle, forceDispatch(stars, 0).forceVehicle);
    assert.ok(officers.every(n => n.forceCharacter === forceDispatch(stars, 0).forceCharacter));
    assert.equal(unit.model, stars === 5 ? 'military-suv' : 'police');
    assert.ok(officers.every(n => n.kind === (stars === 5 ? 'soldier' : 'police')));
    assert.ok(!('path' in unit));
    assert.ok(state.traffic.some(c => c.forceVehicle === 'patrol_sedan'));
  }
});
test('legacy units get local models and civilians cannot inherit uniforms', () => {
  assert.equal(forceVehicleFor({model: 'police'}).id, 'patrol_hatch');
  assert.equal(forceVehicleFor({model: 'military-suv'}).id, 'renea_armored_van');
  assert.equal(forceVehicleFor({model: 'sedan'}), undefined);
  assert.equal(forceCharacterFor({kind: 'civilian', forceCharacter: 'army_soldier'}), undefined);
  assert.equal(forceCharacterFor({kind: 'soldier', forceCharacter: 'police_van'}).id, 'army_soldier');
});
