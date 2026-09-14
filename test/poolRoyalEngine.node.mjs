import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';

const root = new URL('../', import.meta.url).pathname;
const bundle = await build({
  stdin: {
    contents: `
  export * from './webapp/src/pages/Games/shared/poolRoyalPhysics.ts';
  export * from './webapp/src/pages/Games/shared/poolRoyalTableGeometry.ts';
  export * from './webapp/src/pages/Games/shared/poolRoyalAi.ts';
  export { Ball, State } from './webapp/src/vendor/tailuge/model/ball.ts';
  export { bounceHanBlend, rotateApplyUnrotate } from './webapp/src/vendor/tailuge/model/physics/physics.ts';
  `,
    resolveDir: root
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false
});
const engine = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);
const {
  PoolRoyalPhysics,
  PoolRoyalPhysicsClock,
  fitPoolRoyalTable,
  measurePoolRoyalTable,
  planTailugePoolShot,
  probeTailugeShot,
  Ball,
  State,
  bounceHanBlend,
  rotateApplyUnrotate
} = engine;
const metrics = await readPoolRoyalMetrics();
const body = (x = 0, y = 0, vx = 0, vy = 0) => ({
  pos: new THREE.Vector2(x, y),
  vel: new THREE.Vector2(vx, vy),
  omega: new THREE.Vector3(),
  active: true
});
async function table(filename = 'showood-4k.glb') {
  const loader = new GLTFLoader();
  loader.register(() => ({
    name: 'GeometryOnly',
    loadTexture: () => Promise.resolve(null)
  }));
  const bytes = await readFile(
    new URL(
      `../webapp/public/models/pool-royale/showood-seven-foot/${filename}`,
      import.meta.url
    )
  );
  return (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      ''
    )
  ).scene;
}
const close = (a, b, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test('aim guide stops at the ball centre contact on rail faces and jaw endpoints', () => {
  const segment = {
    start: new THREE.Vector2(10, -5),
    end: new THREE.Vector2(10, 5),
    normal: new THREE.Vector2(-1, 0),
    type: 'rail'
  };
  const face = engine.traceMappedPoolCushion(
    new THREE.Vector2(),
    new THREE.Vector2(1, 0),
    [segment],
    1
  );
  close(face.distance, 9);
  const corner = engine.traceMappedPoolCushion(
    new THREE.Vector2(0, 5.5),
    new THREE.Vector2(1, 0),
    [segment],
    1
  );
  close(corner.distance, 10 - Math.sqrt(0.75));
});

test('SI adapter matches the pinned upstream slide, roll and spin trajectory', () => {
  const physics = new PoolRoyalPhysics(metrics.ballR),
    s = physics.metresPerUnit;
  const actual = body(4, -2, 1.3, -0.2);
  actual.omega.set(0.02, 0.18, -0.4);
  const source = new Ball(new THREE.Vector3(4 * s, 2 * s, 0));
  source.vel.set(1.3 * s * 60, 0.2 * s * 60, 0);
  source.rvel.set(1.2, 24, 10.8);
  source.state = State.Sliding;
  for (let i = 0; i < 1800; i++) {
    physics.step(actual, 1 / 240);
    source.update(1 / 240);
    close(actual.pos.x, source.pos.x / s, 1e-7);
    close(actual.pos.y, -source.pos.y / s, 1e-7);
    close(actual.vel.x, source.vel.x / s / 60);
    close(actual.omega.y, source.rvel.z / 60);
  }
});
test('30, 60, 90 and 120 Hz rendering produces identical fixed-step travel', () => {
  const final = [];
  for (const fps of [30, 60, 90, 120]) {
    const physics = new PoolRoyalPhysics(metrics.ballR),
      clock = new PoolRoyalPhysicsClock(),
      b = body(0, 0, 1.5, 0.3);
    for (let frame = 0; frame < fps * 5; frame++) {
      const { physicsSubsteps } = clock.advance(1000 / fps);
      for (let i = 0; i < physicsSubsteps; i++) physics.step(b, 1 / 240);
    }
    final.push([...b.pos.toArray(), ...b.vel.toArray(), ...b.omega.toArray()]);
  }
  final.forEach((value) => assert.deepEqual(value, final[0]));
});
test('head-on ball restitution is the source 0.925 and never adds energy', () => {
  const physics = new PoolRoyalPhysics(1),
    a = body(0, 0, 1, 0),
    b = body(2, 0);
  assert.ok(physics.collide(a, b) > 0);
  close(a.vel.x, 0.0375);
  close(b.vel.x, 0.9625);
  close(a.vel.x + b.vel.x, 1);
  assert.ok(a.vel.lengthSq() + b.vel.lengthSq() < 1);
});
test('screen top/bottom spin produces follow/draw after contact on every heading', () => {
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    for (const sign of [-1, 1]) {
      const physics = new PoolRoyalPhysics(metrics.ballR),
        b = body();
      const direction = new THREE.Vector2(Math.sin(heading), Math.cos(heading));
      physics.strike(b, direction, 3, { x: 0, y: sign * 0.75 });
      b.vel.set(0, 0);
      for (let i = 0; i < 24; i++) physics.step(b, 1 / 240);
      assert.equal(Math.sign(b.vel.dot(direction)), sign);
    }
});
test('Han cushions rotate consistently on all four rails with side spin', () => {
  for (const normal of [
    new THREE.Vector2(-1, 0),
    new THREE.Vector2(1, 0),
    new THREE.Vector2(0, -1),
    new THREE.Vector2(0, 1)
  ]) {
    const physics = new PoolRoyalPhysics(1),
      b = body(0, 0, -normal.x, -normal.y);
    b.omega.y = 0.3;
    const s = physics.metresPerUnit,
      v = new THREE.Vector3(b.vel.x * s * 60, -b.vel.y * s * 60, 0),
      w = new THREE.Vector3(0, 0, 18);
    const delta = rotateApplyUnrotate(
      -Math.atan2(normal.y, -normal.x),
      v,
      w,
      bounceHanBlend
    );
    physics.cushion(b, normal);
    close(b.vel.x, (v.x + delta.v.x) / (s * 60));
    close(b.vel.y, -(v.y + delta.v.y) / (s * 60));
    assert.ok(b.vel.dot(normal) > 0, 'ball returns into the cloth');
  }
});
test('optimized table has six measured pockets, physical ball scale, and a uniform fit', async () => {
  const model = await table(),
    native = measurePoolRoyalTable(model);
  const mapping = fitPoolRoyalTable(
    model,
    metrics.playW,
    metrics.playL,
    metrics.clothY
  );
  assert.equal(mapping.pockets.length, 6);
  close(model.scale.x, model.scale.y);
  close(model.scale.y, model.scale.z);
  close(
    (mapping.max.y - mapping.min.y) * (0.028575 / metrics.ballR),
    native.max.y - native.min.y,
    0.001
  );
  assert.ok(native.pockets.every((p) => p.fitError < 0.00001));
  assert.ok(mapping.segments.some((s) => s.type === 'jaw'));
  assert.ok(
    mapping.segments.every((s) => Math.abs(s.normal.length() - 1) < 1e-7)
  );
  const box = new THREE.Box3().setFromObject(model, true);
  close(box.min.y, metrics.floorY, 0.01);
});
test('AI pots an unobstructed legal target through a measured pocket using the live engine', async () => {
  const physics = new PoolRoyalPhysics(metrics.ballR),
    mapping = fitPoolRoyalTable(
      await table(),
      metrics.playW,
      metrics.playL,
      metrics.clothY
    );
  const pocket = mapping.pockets[0].center;
  const toward = pocket.clone().normalize();
  const target = {
    ...body(pocket.x - toward.x * 12, pocket.y - toward.y * 12),
    id: 'red'
  };
  const cue = {
    ...body(target.pos.x - toward.x * 16, target.pos.y - toward.y * 16),
    id: 'cue'
  };
  const balls = [cue, target];
  const start = performance.now();
  const plan = planTailugePoolShot({
    balls,
    cue,
    legal: [target],
    physics,
    mapping,
    maxSpeed: 4
  });
  assert.equal(plan?.targetBall.id, 'red');
  assert.equal(plan?.type, 'pot');
  assert.equal(
    probeTailugeShot(balls, 'cue', plan, physics, mapping, 4).potted,
    true
  );
  assert.ok(performance.now() - start < 2000, 'bounded planning work');
});
test('all six measured mouths admit a straight shot without phantom cushion faces', async () => {
  const physics = new PoolRoyalPhysics(metrics.ballR),
    mapping = fitPoolRoyalTable(
      await table(),
      metrics.playW,
      metrics.playL,
      metrics.clothY
    );
  for (let pocketIndex = 0; pocketIndex < 6; pocketIndex++) {
    const pocket = mapping.pockets[pocketIndex].center,
      direction = pocket.clone().normalize();
    const target = {
      ...body(pocket.x - direction.x * 12, pocket.y - direction.y * 12),
      id: 'target'
    };
    const cue = {
      ...body(target.pos.x - direction.x * 16, target.pos.y - direction.y * 16),
      id: 'cue'
    };
    const plan = {
      targetBall: target,
      pocketIndex,
      aimDir: direction,
      power: 0.55,
      spin: { x: 0, y: 0 }
    };
    const result = probeTailugeShot(
      [cue, target],
      'cue',
      plan,
      physics,
      mapping,
      4
    );
    assert.equal(
      result.potted,
      true,
      `pocket ${pocketIndex}: ${JSON.stringify(result)}`
    );
  }
});
