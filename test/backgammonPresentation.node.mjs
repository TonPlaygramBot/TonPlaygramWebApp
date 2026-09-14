import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { loadCheckersHumanTemplate } from './checkersHumanFixture.mjs';
import {
  createBackgammonActor,
  updateBackgammonChecker,
  idleBackgammonActor,
  disposeBackgammonActor,
  createBackgammonDiceAction,
  applyBackgammonCamera,
  setBackgammonView
} from '../webapp/src/games/backgammon/presentation.ts';
import {
  backgammonHdriUrls,
  BACKGAMMON_GRAPHICS
} from '../webapp/src/games/backgammon/graphics.ts';
import {
  BACKGAMMON_ARENA,
  BACKGAMMON_PLAY_SCALE,
  createBackgammonPlaySpace,
  backgammonWorldPoint,
  groundBackgammonTable,
  backgammonPedestalScale
} from '../webapp/src/games/backgammon/arenaLayout.ts';
import { createMurlanStyleTable } from '../webapp/src/utils/murlanTable.js';
const template = await loadCheckersHumanTemplate();
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const proceduralTable = createMurlanStyleTable({
  arena: new THREE.Group(),
  tableRadius: BACKGAMMON_ARENA.tableRadius,
  tableHeight: BACKGAMMON_ARENA.tableHeight,
  pedestalHeightScale: backgammonPedestalScale('classicOctagon'),
  textures: false
});
const surfaceHeights = [
  BACKGAMMON_ARENA.tableHeight,
  groundBackgammonTable(proceduralTable.group, proceduralTable.surfaceY)
];

test('real human pinch reaches both board ends, bar and off tray from both seats and table heights', () => {
  for (const surfaceY of surfaceHeights)
    for (const seat of ['bottom', 'top']) {
      const actor = createBackgammonActor(template, seat),
        root = new THREE.Group();
      root.add(actor.root);
      const playSpace = createBackgammonPlaySpace(surfaceY);
      root.add(playSpace);
      for (const [from, to] of [
        [v(-1.08, 1.4, 0.8), v(1.08, 1.4, -0.8)],
        [v(1.08, 1.4, -0.8), v(-1.08, 1.4, 0.8)],
        [v(0, 1.44, 0.25), v(-1.08, 1.4, -0.8)],
        [v(1.08, 1.4, 0.8), v(1.44, 1.4, 0.22)]
      ]) {
        idleBackgammonActor(actor);
        const mesh = new THREE.Object3D();
        playSpace.add(mesh);
        const cell = (p) => ({
          r: (p.z / 0.98 + 1) * 3.5,
          c: (p.x / 1.28 + 1) * 3.5
        });
        const action = {
          mesh,
          from,
          to,
          fromCell: cell(from),
          toCell: cell(to),
          gripHeight: 0.012,
          gripRadius: 0.063 * BACKGAMMON_PLAY_SCALE
        };
        for (let frame = 0; frame <= 40; frame++) {
          const u = frame / 40;
          updateBackgammonChecker(actor, action, u);
          if (u <= 0.3) assert.ok(mesh.position.distanceTo(from) < 1e-8);
          if (u >= 0.82) assert.ok(mesh.position.distanceTo(to) < 1e-8);
          if (u >= 0.3 && u <= 0.8) {
            const contact = playSpace.localToWorld(
              mesh.position.clone().add(v(0, 0.012, 0))
            );
            const pinch = actor.rig.rightHand.localToWorld(
              action.gripAnchorLocal.clone()
            );
            assert.ok(
              contact.distanceTo(pinch) < 0.045 * BACKGAMMON_PLAY_SCALE,
              `${seat} ${from.toArray()} to ${to.toArray()} at ${u}: contact error ${contact.distanceTo(pinch)}`
            );
          }
        }
        playSpace.remove(mesh);
      }
      disposeBackgammonActor(actor);
    }
});
test('dice stay on table until grip, retain pair spacing in hand and land with authoritative faces', () => {
  for (const surfaceY of surfaceHeights)
    for (const seat of ['bottom', 'top']) {
      const actor = createBackgammonActor(template, seat),
        root = new THREE.Group();
      root.add(actor.root);
      const playSpace = createBackgammonPlaySpace(surfaceY);
      root.add(playSpace);
      const dice = [new THREE.Object3D(), new THREE.Object3D()];
      dice.forEach((die, i) => {
        playSpace.add(die);
        die.position.set(0.4 + i * 0.15, 1.42, 0.1);
      });
      const starts = dice.map((die) => die.position.clone());
      const goals = [v(0.4, 1.42, 0), v(0.56, 1.42, 0)];
      const targetQ = [
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0))
      ];
      const motion = createBackgammonDiceAction(actor, dice, goals, targetQ, 0);
      for (let time = 0; time <= 2600; time += 20) {
        motion.update(time);
        if (time < 720)
          dice.forEach((die, i) =>
            assert.ok(die.position.distanceTo(starts[i]) < 1e-8)
          );
        if (time >= 720 && time < 1340)
          assert.ok(
            Math.abs(dice[0].position.distanceTo(dice[1].position) - 0.15) <
              1e-6,
            'pair must not drift in the hand'
          );
      }
      assert.equal(motion.update(2700), true);
      dice.forEach((die, i) => {
        assert.ok(die.position.distanceTo(goals[i]) < 1e-9);
        assert.ok(die.quaternion.angleTo(targetQ[i]) < 1e-6);
      });
      disposeBackgammonActor(actor);
    }
});
test('portrait camera keeps the board, off tray and actual opponent head visible', () => {
  const actor = createBackgammonActor(template, 'top');
  const crown = actor.rig.head
    .getWorldPosition(new THREE.Vector3())
    .add(v(0, 0.25 * BACKGAMMON_PLAY_SCALE, 0));
  for (const surfaceY of surfaceHeights)
    for (const aspect of [320 / 740, 390 / 844, 430 / 932, 1])
      for (const mode of ['2d', '3d']) {
        const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 100),
          target = new THREE.Vector3();
        applyBackgammonCamera(camera, mode, target, surfaceY);
        const points = [-1.42, 1.42].flatMap((x) =>
          [-1.04, 1.04].map((z) => backgammonWorldPoint(x, 1.42, z, surfaceY))
        );
        if (mode === '3d') points.push(crown);
        for (const point of points) {
          const projected = point.clone().project(camera);
          assert.ok(
            Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1,
            `${aspect} ${mode} ${point.toArray()} => ${projected.toArray()}`
          );
        }
        assert.ok(
          backgammonWorldPoint(-1, 1.42, 0.8, surfaceY).project(camera).x <
            backgammonWorldPoint(1, 1.42, 0.8, surfaceY).project(camera).x,
          'screen left/right stay fixed'
        );
      }
  setBackgammonView(actor, '2d');
  disposeBackgammonActor(actor);
});
test('HDRI resolution profiles preserve custom URLs and fall back only downwards', () => {
  const custom = 'https://example.org/custom.hdr';
  assert.deepEqual(backgammonHdriUrls({ assetUrl: custom }, ['2k', '1k']), [
    custom
  ]);
  for (const profile of BACKGAMMON_GRAPHICS) {
    const urls = backgammonHdriUrls(
      { assetId: 'neon_photostudio' },
      profile.resolutions
    );
    assert.equal(urls.length, profile.resolutions.length);
    assert.ok(urls[0].includes(profile.resolutions[0]));
  }
});
