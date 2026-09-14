import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { loadCheckersHumanTemplate } from './checkersHumanFixture.mjs';
import { createFourInRowHuman, disposeFourInRowHuman, idleFourInRowHuman, reserveCapacity, reserveCount, reservePosition, sampleHumanPlacement, advanceHumanPlacement, playerEyePosition, portraitBoardFov, RELEASE_TIME } from '../webapp/src/games/fourinrow/humanPresentation.ts';

const template = await loadCheckersHumanTemplate();
const tableRadius = 3.4 * 0.75 * 0.49 * 0.25 * 0.74 * 1.5 * 1.6 * 1.2 * 1.3;
const tableY = 1.2 * 0.25 * 0.88 * 0.74 * 1.5 * 1.6 * 1.3;
const boardScale = 0.7 * 0.25 * 0.35 * 1.5 * 1.3;
const thickness = 0.15 * boardScale * 0.9;
function dimensions(rows, cols) {
  const width = (1.08 + cols * 0.19) * boardScale * 1.9;
  const height = (0.92 + rows * 0.2) * boardScale * 1.9;
  const radius = Math.min(width / cols, height / rows) * 0.285;
  const bottom = tableY + 0.075 * boardScale;
  return { width, height, radius, bottom, top: bottom + height + height / rows * 0.62 };
}

test('both actual Chess rigs reach all slots and every reserve stack without moving a chip before grip', () => {
  let worst = 0;
  for (const token of ['player', 'ai']) {
    const actor = createFourInRowHuman(template, token, tableRadius, tableY);
    const arena = new THREE.Group(); arena.position.y = 1.23; arena.add(actor.root);
    for (const [rows, cols] of [[6, 7], [7, 8]]) {
      const { width, radius, top } = dimensions(rows, cols);
      const capacity = reserveCapacity(rows, cols);
      for (const index of [capacity - 1, Math.ceil(capacity / 3), 0]) for (let col = 0; col < cols; col++) {
        idleFourInRowHuman(actor);
        const mesh = new THREE.Group(); arena.add(mesh);
        const from = reservePosition(index, token, capacity, radius, thickness * 1.16, tableY, tableRadius);
        const columnTop = new THREE.Vector3((col + 0.5) * width / cols - width / 2, top, 0);
        const action = { actor, mesh, token, from, columnTop, target: columnTop.clone().add(new THREE.Vector3(0, -0.3, 0)), motionTime: 0, chipRadius: radius, chipThickness: thickness, elapsed: 0, phase: 'preview', previewDuration: 0, dropDuration: 0.5, bounceHeight: 0.01 };
        for (let frame = 0; frame < 98; frame++) {
          advanceHumanPlacement(action, 1 / 60);
          const t = action.motionTime;
          if (t < 0.52) assert.ok(mesh.position.distanceTo(from) < 1e-8, 'chip moved before grip');
          if (t >= 0.53 && t < 1.55) {
            const sample = sampleHumanPlacement(t, from, columnTop, radius);
            const contact = new THREE.Vector3(0, thickness * 0.45, -radius * 0.82).applyAxisAngle(new THREE.Vector3(1, 0, 0), sample.angle).add(sample.position);
            arena.localToWorld(contact);
            const actual = actor.rig.rightHand.localToWorld(action.pinch.anchor.clone());
            const error = actual.distanceTo(contact);
            worst = Math.max(worst, error / radius);
            assert.ok(error < radius * 0.23, `${token} ${rows}×${cols} column ${col} reserve ${index} at ${t.toFixed(2)}: missed by ${(error / radius).toFixed(2)} radii`);
          }
          if (t > 0.95 && t < 1.48) assert.ok(mesh.position.y > columnTop.y, 'carry crossed through the rack');
        }
        mesh.removeFromParent();
      }
    }
    disposeFourInRowHuman(actor);
  }
  console.log(`Worst hand contact error: ${worst.toFixed(3)} chip radii`);
});

test('pickup, release, gravity and withdrawal finish once at 30–240 Hz', () => {
  for (const hz of [30, 50, 60, 90, 120, 144, 240]) {
    const mesh = new THREE.Group(), from = new THREE.Vector3(0.1, 0.6, 0.4), columnTop = new THREE.Vector3(-0.2, 1.2, 0);
    const action = { mesh, token: 'player', from, columnTop, target: new THREE.Vector3(-0.2, 0.65, 0), motionTime: 0, chipRadius: 0.025, chipThickness: 0.015, elapsed: 0, phase: 'preview', previewDuration: 0, dropDuration: 0.5, bounceHeight: 0.015 };
    let impacts = 0, done = false;
    for (let frame = 0; frame < hz * 3; frame++) {
      const result = advanceHumanPlacement(action, 1 / hz);
      impacts += Number(result.landed);
      if (action.motionTime >= RELEASE_TIME) assert.ok(mesh.position.y >= action.target.y);
      if (result.finished) { done = true; assert.ok(action.motionTime >= 2.12); break; }
    }
    assert.equal(impacts, 1); assert.equal(done, true);
    assert.ok(mesh.position.equals(action.target));
    assert.equal(mesh.rotation.x, Math.PI / 2);
  }
});

test('reserve counts track boards and reset across supported layouts', () => {
  for (const [rows, cols] of [[6, 7], [7, 8]]) {
    const board = Array.from({ length: rows }, () => Array(cols).fill(null));
    const capacity = reserveCapacity(rows, cols);
    assert.equal(reserveCount(board, 'player'), capacity);
    board[rows - 1][0] = 'player'; board[rows - 1][1] = 'ai';
    assert.equal(reserveCount(board, 'player'), capacity - 1);
    assert.equal(reserveCount(board, 'ai'), capacity - 1);
  }
});

test('player-eye portrait camera includes the complete board and opponent head', () => {
  const arena = new THREE.Group();
  const local = createFourInRowHuman(template, 'player', tableRadius, tableY);
  const rival = createFourInRowHuman(template, 'ai', tableRadius, tableY);
  arena.add(local.root, rival.root);
  const eye = playerEyePosition(local, arena);
  for (const [rows, cols] of [[6, 7], [7, 8]]) for (const aspect of [320 / 740, 390 / 844, 430 / 932]) {
    const { width, height, bottom } = dimensions(rows, cols);
    const camera = new THREE.PerspectiveCamera(portraitBoardFov(aspect, width, eye.z), aspect, 0.015, 200);
    camera.position.copy(eye); camera.lookAt(0, bottom + height * 0.64, 0); camera.updateMatrixWorld(true);
    for (const x of [-width / 2, width / 2]) for (const y of [bottom, bottom + height]) {
      const projected = new THREE.Vector3(x, y, 0).project(camera);
      assert.ok(Math.abs(projected.x) < 0.94 && Math.abs(projected.y) < 0.76, `board cropped: ${projected.toArray()}`);
    }
    const head = rival.rig.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.14, 0)).project(camera);
    assert.ok(head.y < 0.62 && head.y > -0.5, `opponent overlaps header: ${head.y}`);
  }
  disposeFourInRowHuman(local); disposeFourInRowHuman(rival);
});
