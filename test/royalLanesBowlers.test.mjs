import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(new URL('../webapp/package.json', import.meta.url));
const threeURL = new URL('../webapp/node_modules/three/build/three.module.js', import.meta.url).href;
const skeletonURL = pathToFileURL(require.resolve('three/examples/jsm/utils/SkeletonUtils.js')).href;
const loaderURL = pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js')).href;
const THREE = await import(threeURL);
const { GLTFLoader } = await import(loaderURL);
const source = await readFile(new URL('../webapp/src/games/royallanes/bowlers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  .replace("from 'three'", `from '${threeURL}'`)
  .replace("from 'three/examples/jsm/utils/SkeletonUtils.js'", `from '${skeletonURL}'`);
const { HumanBowler } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

// Load the production GLB geometry and rig. Texture decoding needs a browser;
// texture placeholders keep this check about the actual skeleton and animation.
const loader = new GLTFLoader();
loader.register(() => ({ name: 'TEST_TEXTURE_PLACEHOLDER', loadTexture: async () => new THREE.Texture() }));
const bytes = await readFile(new URL('../webapp/public/assets/pool-royale/readyplayer.me.glb', import.meta.url));
const { scene: prototype } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');

test('the existing human GLB provides a clear eye-level view and connected ball hand', () => {
  const local = new HumanBowler(prototype, 0xb4d5be, true);
  const opponent = new HumanBowler(prototype, 0xe3bdad, false);
  for (const name of ['head', 'hips', 'rightarm', 'rightforearm', 'righthand', 'leftfoot', 'rightfoot']) assert.ok(local.bones.has(name), name);
  local.pose({ active: true, rolling: false, elapsed: 0, dt: 10, watching: false, time: 0 });
  opponent.pose({ active: false, rolling: false, elapsed: 0, dt: 10, watching: true, time: 0 });
  assert.ok(local.eye.y > 1.5 && local.eye.y < 1.9, `Eye height ${local.eye.y}`);
  assert.ok(local.eye.z > 1.5 && local.eye.z < 2.6, `Eye at approach ${local.eye.z}`);
  assert.ok(local.ballSocket.distanceTo(local.bones.get('righthand').getWorldPosition(new THREE.Vector3())) < .13);
  assert.ok(opponent.root.position.x > .9, 'Opponent leaves the lane clear');
  const firstPersonHead = local.model.getObjectByName('Wolf3D_Head');
  const visibleOpponentHead = opponent.model.getObjectByName('Wolf3D_Head');
  assert.ok(!firstPersonHead.layers.isEnabled(0));
  assert.ok(visibleOpponentHead.layers.isEnabled(0));
  assert.notEqual(local.bones.get('righthand'), opponent.bones.get('righthand'));
  local.dispose(); opponent.dispose();
});

test('the full delivery has finite grounded limbs, a low release, and independent skeletons', () => {
  const local = new HumanBowler(prototype, 0xffffff, true);
  const opponent = new HumanBowler(prototype, 0xffffff, false);
  opponent.pose({ active: false, rolling: false, elapsed: 0, dt: 10, watching: true, time: 0 });
  const fixedHand = opponent.bones.get('righthand').getWorldPosition(new THREE.Vector3());
  local.pose({ active: true, rolling: false, elapsed: 0, dt: 10, watching: false, time: 0 });
  let release;
  for (let frame = 0; frame <= 240; frame++) {
    const elapsed = frame / 60;
    local.pose({ active: true, rolling: true, elapsed, dt: 1 / 60, watching: false, time: elapsed * 1000 });
    for (const bone of local.bones.values()) assert.ok(bone.matrixWorld.elements.every(Number.isFinite), bone.name);
    for (const name of ['leftfoot', 'rightfoot']) {
      const foot = local.bones.get(name).getWorldPosition(new THREE.Vector3());
      assert.ok(foot.y > -.05 && foot.y < .22, `${name} above the floor: ${foot.y}`);
    }
    if (frame === 69) release = local.ballSocket.clone();
  }
  assert.ok(release.y > .08 && release.y < .5, `Release height ${release.y}`);
  assert.ok(release.z > -.2 && release.z < .3, `Release by the foul line ${release.z}`);
  assert.ok(opponent.bones.get('righthand').getWorldPosition(new THREE.Vector3()).distanceTo(fixedHand) < 1e-8);
  local.dispose(); opponent.dispose();
});
