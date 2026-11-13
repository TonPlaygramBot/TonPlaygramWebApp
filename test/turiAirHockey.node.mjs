import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { humanoidPalmPoint } from '../webapp/src/games/tiranastreets/street-career/humanoidHands.mjs';

const webapp = fileURLToPath(new URL('../webapp/', import.meta.url));
const dir = await mkdtemp(join(webapp, '.turi-air-hockey-'));
after(() => rm(dir, { recursive: true, force: true }));
await build({ entryPoints: [join(webapp, 'src/components/airHockey/turiPlayer.ts')], outfile: join(dir, 'player.mjs'),
  bundle: true, format: 'esm', platform: 'node', external: ['three', 'three/*'], logLevel: 'silent' });
const { AirHockeyTuriPlayer } = await import(pathToFileURL(join(dir, 'player.mjs')));

test('real Turi follows the mallet, retains his source atlas and releases resources once', async () => {
  const bytes = await readFile(join(webapp, 'public/assets/tirana-streets/players/turi.glb'));
  const loader = new GLTFLoader();
  loader.register(() => ({ name: 'HEADLESS_TEXTURES', loadTexture: async () => new T.Texture() }));
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const sources = new Map();
  gltf.scene.traverse(mesh => { if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) sources.set(material.name, material.map?.source); });
  const actor = new AirHockeyTuriPlayer(gltf.scene, { width: 54.251, length: 108.502, surfaceY: 4.525 }, 2);
  const scene = new T.Scene(); scene.add(actor.root);
  const table = new T.Group(); table.position.y = 4.525; scene.add(table);
  const mallet = new T.Object3D(); table.add(mallet);
  const before = new T.Vector3();
  const groundFeet = ['left', 'right'].map(side => actor.bones.get(side + 'foot').getWorldPosition(new T.Vector3()));
  for (const [x, z] of [[0, 45], [-18, 40], [18, 40], [0, 12], [-23, 4], [23, 4], [0, 50]]) {
    mallet.position.set(x, 0, z); scene.updateMatrixWorld(true);
    for (let frame = 0; frame < 10; frame++) actor.update(mallet, 3);
    for (const bone of actor.bones.values()) assert.ok(bone.matrixWorld.elements.every(Number.isFinite));
    assert.equal(mallet.position.x, x); assert.equal(mallet.position.z, z, 'actor cannot move the physics mallet');
    const hand = humanoidPalmPoint(actor.bones, 'right');
    const target = mallet.getWorldPosition(new T.Vector3()); target.y += 3;
    assert.ok(hand.distanceTo(target) < .5, `Palm contact at ${x},${z}: ${hand.distanceTo(target)}`);
    for (const [i, side] of ['left', 'right'].entries()) {
      const foot = actor.bones.get(side + 'foot').getWorldPosition(new T.Vector3());
      assert.ok(Math.abs(foot.y - groundFeet[i].y) < .5, `${side} foot remains planted at ${x},${z}: ${foot.y - groundFeet[i].y}`);
    }
    before.copy(hand); actor.update(mallet, 3);
    assert.ok(humanoidPalmPoint(actor.bones, 'right').distanceTo(before) < .001, 'repeated pose is stable');
  }
  gltf.scene.traverse(mesh => { if (mesh.isMesh) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    assert.equal(material.map?.source, sources.get(material.name));
    if (material.map) assert.equal(material.map.anisotropy, 2);
  } });
  let disposed = 0;
  gltf.scene.traverse(mesh => { if (mesh.isMesh) mesh.geometry.addEventListener('dispose', () => disposed++); });
  actor.dispose(); const first = disposed; actor.dispose();
  assert.equal(actor.root.parent, null); assert.equal(disposed, first); assert.ok(first > 0);
});
