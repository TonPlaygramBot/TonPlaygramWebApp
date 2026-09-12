import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BowlingPhysics } from '../webapp/src/games/royallanes/shared/physics.mjs';
import {
  LANE_SCALE_X,
  LANE_WIDTH,
  LANE_SPACING,
  GUTTER_THRESHOLD
} from '../webapp/src/games/royallanes/shared/physicsCore.mjs';
import {
  simulateRoll,
  ALL_PINS
} from '../webapp/src/games/royallanes/shared/replay.mjs';

const root = new URL('../', import.meta.url);
const result = await build({
  stdin: {
    contents:
      "export { BowlingCamera } from './webapp/src/games/royallanes/camera'; export { HumanBowler } from './webapp/src/games/royallanes/bowlers';",
    resolveDir: root.pathname,
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  plugins: [
    {
      name: 'one-three-instance',
      setup(api) {
        api.onResolve({ filter: /^three$/ }, () => ({
          path: new URL('webapp/node_modules/three/build/three.module.js', root)
            .href,
          external: true
        }));
      }
    }
  ]
});
const { BowlingCamera, HumanBowler } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
);
const loader = new GLTFLoader();
loader.register(() => ({
  name: 'TEST_TEXTURE_PLACEHOLDER',
  loadTexture: async () => new T.Texture()
}));
async function asset(path) {
  const bytes = await readFile(
    new URL(`webapp/public/assets/${path}.glb`, root)
  );
  return (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      ''
    )
  ).scene;
}
const prototypes = await Promise.all(
  [
    'pool-royale/readyplayer.me',
    'table-tennis/athlete-male',
    'table-tennis/athlete-female'
  ].map(asset)
);
const alley = await asset('royal-lanes/models/royal-alley');
alley.scale.x *= LANE_SCALE_X;
alley.updateMatrixWorld(true);

test('all three actual human rigs have visible body, clothing and head draw calls', () => {
  for (const prototype of prototypes) {
    const actor = new HumanBowler(prototype, 0xffffff, false);
    let count = 0;
    actor.model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      count++;
      const original = prototype.getObjectByName(mesh.name);
      assert.equal(
        Array.isArray(mesh.material),
        Array.isArray(original.material),
        mesh.name
      );
      assert.ok(
        mesh.visible && mesh.layers.isEnabled(0),
        `${mesh.name} visible to the camera`
      );
      const draws = Array.isArray(mesh.material)
        ? mesh.geometry.groups.filter(
            (g) => g.count > 0 && mesh.material[g.materialIndex]?.visible
          ).length
        : Number(
            mesh.material.visible && mesh.geometry.attributes.position.count > 0
          );
      assert.ok(draws > 0, `${mesh.name} submits geometry to the renderer`);
    });
    assert.ok(count >= 3);
    actor.dispose();
  }
});

test('phone framing shows a full player and neighbour; wide framing shows both neighbours', () => {
  for (const aspect of [320 / 844, 390 / 844, 390 / 488, 768 / 600]) {
    const camera = new T.PerspectiveCamera(64, aspect, 0.025, 85);
    const rig = new BowlingCamera(camera);
    rig.update(0, {
      ball: new T.Vector3(),
      hasRoll: false,
      releaseElapsed: -1,
      duration: 0
    });
    for (const [index, x] of [0, -LANE_SPACING, LANE_SPACING].entries()) {
      if (aspect < 1 && index === 1) continue;
      const parent = new T.Group();
      parent.position.x = x;
      const actor = new HumanBowler(prototypes[index], 0xffffff, false);
      parent.add(actor.root);
      actor.pose({
        active: true,
        rolling: false,
        elapsed: 0,
        dt: 10,
        time: 0,
        watching: false
      });
      const bounds = new T.Box2();
      actor.model.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.skeleton?.update();
        // Project deformed vertices, not just skeletons or bind-pose bounds.
        for (let i = 0; i < mesh.geometry.attributes.position.count; i += 11) {
          const p = mesh
            .getVertexPosition(i, new T.Vector3())
            .applyMatrix4(mesh.matrixWorld)
            .project(camera);
          assert.ok(p.z > -1 && p.z < 1, 'in front of camera');
          bounds.expandByPoint(new T.Vector2(p.x, p.y));
        }
      });
      assert.ok(
        bounds.min.x > -1 && bounds.max.x < 1,
        `body fits width: ${aspect}/${index}: ${bounds.min.x}, ${bounds.max.x}`
      );
      assert.ok(
        bounds.min.y > -0.8 && bounds.max.y < 0.4,
        `body clears scorecard and guidance: ${bounds.min.y}, ${bounds.max.y}`
      );
      assert.ok(
        bounds.max.y - bounds.min.y > 0.2,
        `body readable: ${aspect}: ${bounds.max.y - bounds.min.y}`
      );
      for (const name of ['head', 'hips', 'leftfoot', 'rightfoot']) {
        const p = actor.bones.get(name).getWorldPosition(new T.Vector3());
        const ray = new T.Raycaster(
          camera.position,
          p.clone().sub(camera.position).normalize(),
          0.025,
          camera.position.distanceTo(p) - 0.1
        );
        assert.equal(
          ray.intersectObject(alley, true).length,
          0,
          `alley does not hide ${name}`
        );
      }
      actor.dispose();
    }
  }
});

test('camera tracks centre and gutter shots smoothly, holds the pins and returns at 30/60/120 FPS', () => {
  const shots = [0.055, -1.2, 1.2].map((aim) =>
    simulateRoll(
      { shot: { aim, hook: 0, power: 78 }, standing: ALL_PINS },
      BowlingPhysics
    )
  );
  for (const fps of [30, 60, 120])
    for (const replay of shots) {
      const camera = new T.PerspectiveCamera(64, 390 / 844, 0.025, 85);
      const rig = new BowlingCamera(camera);
      const ball = new T.Vector3(0, 0.1105, -0.04);
      rig.update(0, { ball, hasRoll: false, releaseElapsed: -1, duration: 0 });
      const home = camera.position.clone(),
        previous = camera.position.clone();
      let closestZ = 0;
      for (
        let frame = 0;
        frame < (replay.durationMs / 1000 + 4) * fps;
        frame++
      ) {
        const t = frame / fps,
          index = Math.min(replay.frames.length - 1, Math.floor(t * replay.hz));
        ball.fromArray(replay.frames[index]);
        rig.update(1 / fps, {
          ball,
          hasRoll: true,
          releaseElapsed: t,
          duration: replay.durationMs / 1000
        });
        assert.ok(camera.position.toArray().every(Number.isFinite));
        assert.ok(
          camera.position.distanceTo(previous) < 1.5,
          'no camera teleport'
        );
        assert.ok(
          camera.position.y >= 1.4 && camera.position.z >= -15.61,
          'camera stays above the lane and outside pin deck'
        );
        if (t > 0.75 && ball.z > -19.5) {
          const p = ball.clone().project(camera);
          assert.ok(
            Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.85 && p.z < 1,
            'moving ball remains visible'
          );
        }
        closestZ = Math.min(closestZ, camera.position.z);
        previous.copy(camera.position);
      }
      assert.ok(closestZ < -15, 'camera travels down the lane');
      assert.ok(
        camera.position.distanceTo(home) < 0.01,
        'camera returns for the next turn'
      );
    }
});

test('wider lane artwork and colliders agree; edge shots stay supported and gutters still count', () => {
  const lane = alley.getObjectByName('Lane_surface_0');
  const size = new T.Box3().setFromObject(lane).getSize(new T.Vector3());
  assert.ok(Math.abs(size.x - LANE_WIDTH) < 0.0001);
  for (const side of [-1, 1]) {
    const physics = new BowlingPhysics();
    const surface = physics.world.bodies.find(
      (b) => b.mass === 0 && b.position.y === -0.1
    );
    assert.ok(
      Math.abs(surface.shapes[0].halfExtents.x * 2 - LANE_WIDTH) < 1e-8
    );
    physics.launch({ aim: 0, hook: 0, power: 78 });
    physics.ball.position.set(side * 0.58, 0.1105, -5);
    physics.ball.angularVelocity.setZero();
    for (let n = 0; n < 30; n++) physics.step();
    assert.equal(
      physics.gutter,
      false,
      'new surface outside the old lane supports the ball'
    );
    assert.ok(physics.ball.position.y > 0.1);
    physics.ball.position.x = side * (GUTTER_THRESHOLD + 0.02);
    physics.step();
    assert.equal(physics.gutter, true);
    assert.equal(
      physics.ball.collisionFilterMask,
      1,
      'gutter ball cannot knock down pins'
    );
    physics.dispose();
  }
});
