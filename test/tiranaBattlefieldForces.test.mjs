import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildSync} from '../webapp/node_modules/esbuild/lib/main.js';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {props, OBSTACLES, START, EXTRACTION, BATTLEFIELD_MAPS} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {collides} from '../webapp/src/games/blackwater/shared/physics.mjs';
const temp = new URL('../webapp/node_modules/.cache/battlefield-force-test/', import.meta.url);
mkdirSync(temp, {recursive: true});


const fetchOriginal = globalThis.fetch, bitmapOriginal = globalThis.createImageBitmap, selfOriginal = globalThis.self;
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({width: 1, height: 1, close(){}});
globalThis.fetch = async (url, options) => String(url).startsWith('blob:') ? fetchOriginal(url, options)
  : new Response(readFileSync(new URL(`../webapp/public${url}`, import.meta.url)));
test.after(() => {globalThis.fetch = fetchOriginal; globalThis.createImageBitmap = bitmapOriginal; globalThis.self = selfOriginal; rmSync(temp, {recursive:true, force:true});});
async function settle(visuals) {
  const deadline = Date.now() + 10000;
  while (visuals.pending.size) {assert.ok(Date.now() < deadline); await new Promise(r => setTimeout(r, 10));}
  assert.equal(visuals.errors.size, 0);
}

test('all eight vehicle covers use original metre bounds shared with server collision', async () => {
  const fleet = props.filter(p => p.forceVehicle);
  assert.equal(new Set(fleet.map(p => p.forceVehicle)).size, 8);
  for (const p of fleet) {
    assert.ok(OBSTACLES.includes(p)); assert.equal(collides(p.x, p.z, .1, OBSTACLES), true);
    assert.equal(collides(p.x, p.z, Math.hypot(p.w, p.d) / 2 + .3, OBSTACLES.filter(o => o !== p)), false, `${p.forceVehicle}: no overlapping cover`);
    assert.ok(Math.hypot(p.x - BATTLEFIELD_MAPS[0].start.x, p.z - BATTLEFIELD_MAPS[0].start.z) < 65, 'original fleet is within loading range at deployment');
    const b = readFileSync(new URL(`../webapp/public/assets/tirana-streets/albanian-forces/glb/${p.forceVehicle}.glb`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
    gltf.scene.rotation.y = -Math.PI/2;
    gltf.scene.updateMatrixWorld(true);
    const size = new T.Box3().setFromObject(gltf.scene, true).getSize(new T.Vector3());
    assert.ok(p.w >= size.x && p.w - size.x < .002, p.forceVehicle);
    assert.ok(p.d >= size.z && p.d - size.z < .002, p.forceVehicle);
    assert.ok(p.h >= size.y + .03 && p.h - size.y - .03 < .002, p.forceVehicle);
  }
  for (const p of [START, EXTRACTION, ...BATTLEFIELD_MAPS.flatMap(m=>[m.start,m.extraction])]) {
    assert.equal(collides(p.x, p.z, .45, OBSTACLES), false, 'deployment and extraction remain clear');
  }
});
