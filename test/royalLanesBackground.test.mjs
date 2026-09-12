import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { BowlingPhysics } from '../webapp/src/games/royallanes/shared/physics.mjs';
import { simulateRoll } from '../webapp/src/games/royallanes/shared/replay.mjs';
const require = createRequire(
  new URL('../webapp/package.json', import.meta.url)
);
const threeURL = new URL(
  '../webapp/node_modules/three/build/three.module.js',
  import.meta.url
).href;
const THREE = await import(threeURL);
const { GLTFLoader } = await import(
  pathToFileURL(require.resolve('three/examples/jsm/loaders/GLTFLoader.js'))
);
const loader = new GLTFLoader();
loader.register(() => ({
  name: 'TEST_TEXTURE_PLACEHOLDER',
  loadTexture: async () => new THREE.Texture()
}));
const bytes = await readFile(
  new URL(
    '../webapp/public/assets/table-tennis/athlete-male.glb',
    import.meta.url
  )
);
const { scene: prototype } = await loader.parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  ''
);
let jobs = [],
  closed = 0;
globalThis.__royalNpcSimulation = (shot, standing) => {
  const replay = simulateRoll({ shot, standing }, BowlingPhysics);
  jobs.push({ standing: [...standing], replay });
  return Promise.resolve(replay);
};
globalThis.__royalNpcClose = () => {
  closed++;
};
const compiled = await build({
  entryPoints: [
    new URL(
      '../webapp/src/games/royallanes/backgroundLanes.ts',
      import.meta.url
    ).pathname
  ],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [
    {
      name: 'test-worker-boundary',
      setup(api) {
        api.onResolve({ filter: /^\.\/simulator$/ }, () => ({
          path: 'simulator',
          namespace: 'test'
        }));
        api.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents:
            'export class RollSimulator { run(shot,standing){return globalThis.__royalNpcSimulation(shot,standing);} dispose(){globalThis.__royalNpcClose();} }'
        }));
        api.onResolve({ filter: /^three(\/.*)?$/ }, (args) => ({
          path:
            args.path === 'three'
              ? threeURL
              : pathToFileURL(require.resolve(args.path)).href,
          external: true
        }));
      }
    }
  ]
});
const { BackgroundLanes } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`
);
test('neighbouring lanes repeatedly bowl, leave spare racks, return and release their worker', async () => {
  const sounds = [];
  const audio = {
    rolling: () => {},
    step: () => {},
    release: (...a) => sounds.push(['release', ...a]),
    impact: () => {},
    sweep: () => {}
  };
  const background = new BackgroundLanes(
    [prototype],
    new THREE.Group(),
    new THREE.Group(),
    audio
  );
  let maxBusy = 0;
  for (let frame = 0; frame < 30 * 130; frame++) {
    background.update(
      1 / 30,
      (frame / 30) * 1000,
      new THREE.Vector3(0, 1.65, 2)
    );
    await Promise.resolve();
    await Promise.resolve();
    maxBusy = Math.max(maxBusy, background.lanes.filter((l) => l.busy).length);
    for (const lane of background.lanes) {
      assert.ok(lane.ball.position.toArray().every(Number.isFinite));
      if (lane.phase === 'bowling' && lane.time < 2.2) {
        assert.ok(
          lane.ball.position.distanceTo(lane.bowler.ballSocket) < 1e-8,
          'held ball follows the bowler'
        );
        lane.group.updateMatrixWorld(true);
        const hand = lane.bowler.bones
          .get('righthand')
          .getWorldPosition(new THREE.Vector3());
        assert.ok(
          lane.ball.getWorldPosition(new THREE.Vector3()).distanceTo(hand) <
            0.13,
          'neighbour ball stays attached in world coordinates'
        );
        assert.ok(
          Math.abs(hand.x - lane.group.position.x) < 0.8,
          'neighbour reaches within its own lane'
        );
      }
    }
  }
  assert.ok(
    background.lanes.every((l) => l.cycle >= 3),
    'both lanes complete repeated independent cycles'
  );
  assert.ok(
    jobs.some((j) => j.standing.length < 10),
    'second balls target actual spare racks'
  );
  assert.ok(maxBusy <= 2, 'one outstanding simulation per lane');
  assert.ok(
    sounds.some((s) => s[1] < 0) && sounds.some((s) => s[1] > 0),
    'neighbour releases pan to opposite screen sides'
  );
  const count = jobs.length;
  background.dispose();
  background.update(30, 140000, new THREE.Vector3());
  await Promise.resolve();
  assert.equal(jobs.length, count);
  assert.equal(closed, 1);
  assert.equal(background.group.parent, null);
});
