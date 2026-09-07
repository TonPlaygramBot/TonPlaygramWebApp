import { createRequire } from 'node:module';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import {
  makeTrack,
  createRacer
} from '../webapp/src/games/kartroyale/simulation.mjs';
const root = new URL('../', import.meta.url).pathname,
  require = createRequire(new URL('../webapp/package.json', import.meta.url));
const { createCanvas } = require('@napi-rs/canvas');
globalThis.document = {
  createElement: (tag) => {
    assert.equal(tag, 'canvas');
    return createCanvas(1, 1);
  }
};
const { build } = require('esbuild'),
  temp = await mkdtemp(join(tmpdir(), 'racing-scene-'));
try {
  const entry = `export { TiranaScenery,occupied } from './webapp/src/games/kartroyale/tiranaScenery';export { Supporters } from './webapp/src/games/kartroyale/supporters';export { PoliceResponse } from './webapp/src/games/kartroyale/policeResponse';export { cloneHuman,prepareHuman,poseHuman } from './webapp/src/games/kartroyale/supporterHuman';export * as T from 'three';export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';`;
  await build({
    stdin: {
      contents: entry,
      resolveDir: root,
      sourcefile: 'verify-racing.ts'
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: join(temp, 'scene.mjs'),
    nodePaths: [join(root, 'webapp/node_modules')]
  });
  const {
    T,
    GLTFLoader,
    TiranaScenery,
    Supporters,
    PoliceResponse,
    cloneHuman,
    prepareHuman,
    poseHuman
  } = await import(pathToFileURL(join(temp, 'scene.mjs')));
  const loader = new GLTFLoader();
  const model = async (id) => {
    const b = await readFile(
      join(root, `webapp/public/assets/kart-royale/cast/${id}.glb`)
    );
    return (
      await loader.parseAsync(
        b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
        ''
      )
    ).scene;
  };
  const templates = [];
  for (const id of [
    'edi-rama',
    'belinda-balluku',
    'erion-brace',
    'ulsi-manja',
    'blendi-gonxhe'
  ]) {
    const template = prepareHuman(await model(id), id === 'belinda-balluku'),
      h = cloneHuman(template);
    templates.push(template);
    assert.ok(h.bones.get('hand_r')?.length, id);
    for (const age of [-1, 0, 0.3, 0.68, 1, 1.45]) {
      poseHuman(h, 2, age, true);
      h.root.updateMatrixWorld(true);
      h.root.traverse((o) =>
        assert.ok(o.matrixWorld.elements.every(Number.isFinite), id)
      );
    }
  }
  const track = makeTrack('surrel'),
    city = new TiranaScenery(track, false);
  await city.city.ready;
  assert.equal(city.group.userData.buildings, 2686);
  assert.equal(city.group.userData.roads, 12299);
  city.update(100, 100, false, 1);
  city.update(7300, -500, true, 2);
  const crowd = new Supporters(track, new T.Texture(), templates),
    police = new PoliceResponse(
      track,
      prepareHuman(await model('police'), false),
      await model('water-cannon')
    );
  let throws = 0;
  const me = createRacer(track, 'you', 'You');
  me.speed = 15;
  // Exercise actual skinned crowd windup/release, then the police response beside Parliament.
  const fan = crowd.fans.find(
    (f) =>
      Math.hypot(f.x - track.points.at(-1).x, f.z - track.points.at(-1).z) < 27
  );
  assert.ok(fan, 'Parliament has a crowd');
  me.x = fan.x - 15;
  me.z = fan.z;
  me.yaw = Math.PI / 2;
  me.velocityYaw = me.yaw;
  for (let i = 0; i < 240; i++) {
    const time = i / 60;
    crowd.update(time, me, [me], false, true, () => throws++);
    police.update(time, me, crowd.events, true, false, (seed, time) =>
      crowd.wet(seed, time)
    );
  }
  assert.ok(throws > 0, 'crowd releases from a real hand');
  assert.ok(crowd.events.length > 0);
  const truck = police.truck.position;
  police.update(
    10,
    me,
    [{ id: 999, time: 9.5, x: truck.x + 9, z: truck.z, seed: fan.seed }],
    true,
    false,
    (seed, time) => crowd.wet(seed, time)
  );
  assert.equal(police.water.visible, true);
  assert.equal(police.spray.count, 96);
  assert.ok(fan.wetUntil > 10);
  for (const group of [city.group, crowd.group, police.group])
    group.traverse((o) => {
      if (o.geometry)
        for (const a of Object.values(o.geometry.attributes))
          assert.ok(
            Array.from(a.array).every(Number.isFinite),
            'finite GPU geometry'
          );
    });
  police.dispose();
  crowd.dispose();
  city.dispose();
  console.log(
    'PASS: shared city, all five Blender rigs, live crowd throws, police water response, finite GPU data and disposal'
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
