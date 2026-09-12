import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { APPROACH_MS } from '../webapp/src/games/royallanes/shared/replay.mjs';

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
    if (frame === Math.round(APPROACH_MS / 1000 * 60)) release = local.ballSocket.clone();
  }
  assert.ok(release.y > .08 && release.y < .5, `Release height ${release.y}`);
  assert.ok(release.z > -.2 && release.z < .3, `Release by the foul line ${release.z}`);
  assert.ok(opponent.bones.get('righthand').getWorldPosition(new THREE.Vector3()).distanceTo(fixedHand) < 1e-8);
  local.dispose(); opponent.dispose();
});

for (const asset of [
  'table-tennis/athlete-male',
  'table-tennis/athlete-female',
  'pool-royale/readyplayer.me'
]) {
  test(`${asset}: repeated deliveries keep hands, feet and clothing aligned at 30/60/120 FPS`, async () => {
    const bytes = await readFile(
      new URL(`../webapp/public/assets/${asset}.glb`, import.meta.url)
    );
    const { scene } = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      ''
    );
    for (const fps of [30, 60, 120]) {
      const bowler = new HumanBowler(scene, 0xffffff, false);
      for (let cycle = 0; cycle < 3; cycle++) {
        bowler.pose({
          active: true,
          rolling: false,
          elapsed: 0,
          dt: 10,
          watching: false,
          time: 0
        });
        for (let frame = 0; frame <= fps * 7; frame++) {
          const elapsed = frame / fps;
          bowler.pose({
            active: true,
            rolling: true,
            elapsed,
            dt: 1 / fps,
            watching: false,
            time: elapsed * 1000,
            reaction: 'strike',
            reactionElapsed: elapsed - 5
          });
          for (const b of bowler.bones.values())
            assert.ok(
              b.matrixWorld.elements.every(Number.isFinite),
              `${asset}/${b.name}`
            );
          for (const side of ['left', 'right']) {
            const foot = bowler.bones
              .get(`${side}foot`)
              .getWorldPosition(new THREE.Vector3());
            assert.ok(
              foot.y > -0.02 && foot.y < 0.23,
              `${asset} ${fps} ${elapsed} ${side} foot ${foot.y}`
            );
          }
          if (frame === Math.round((APPROACH_MS / 1000) * fps)) {
            const launch = new THREE.Vector3(0, 0.1105, -0.04);
            assert.ok(
              bowler.bones.get('hips').getWorldPosition(new THREE.Vector3()).y >
                0.48,
              'release is a forward bend, not a deep squat'
            );
            assert.ok(
              bowler.ballSocket.distanceTo(launch) < 0.01,
              `${asset} launch gap ${bowler.ballSocket.distanceTo(launch)} ${bowler.ballSocket.toArray()}`
            );
          }
        }
        for (const { bone, source } of bowler.followers) {
          assert.ok(
            bone
              .getWorldQuaternion(new THREE.Quaternion())
              .normalize()
              .angleTo(
                source.getWorldQuaternion(new THREE.Quaternion()).normalize()
              ) < 1e-5,
            `${asset}: clothing rotation ${bone.name}`
          );
          assert.ok(
            bone
              .getWorldPosition(new THREE.Vector3())
              .distanceTo(source.getWorldPosition(new THREE.Vector3())) < 0.01,
            `${asset}: clothing position ${bone.name}`
          );
        }
        for (let frame = 0; frame < fps * 3; frame++)
          bowler.pose({
            active: false,
            rolling: false,
            elapsed: 0,
            dt: 1 / fps,
            watching: true,
            time: (frame / fps) * 1000
          });
        assert.ok(
          bowler.root.position.x > 1.1,
          'returns out of the active lane'
        );
      }
      bowler.dispose();
    }
  });
}
