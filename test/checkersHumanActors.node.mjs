import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { loadCheckersHumanTemplate } from './checkersHumanFixture.mjs';
import { createCheckersHumanActor, updateCheckersHumanMove, idleCheckersHuman, disposeCheckersHuman, setCheckersHumanView, checkersSeatForSide, checkersPortraitFov, CHECKERS_HUMAN_CAMERA_TARGET_HEIGHT, PHYSICAL_MOVE_DURATION_MS } from '../webapp/src/games/checkers/checkersHumanActors.ts';
import { PHYSICAL_MOVE_DURATION_MS as CHESS_DURATION } from '../webapp/src/games/chess/physicalPieceMove.ts';

const template = await loadCheckersHumanTemplate();
const scale = 0.48 * 0.68, modelScale = 0.75 * scale, stoolScale = 1.02 * scale;
const tableRadius = 2.6 * modelScale;
const tableY = 0.98 * modelScale - 0.09 * modelScale * stoolScale * 0.85 - 0.4 * modelScale + 0.09 * modelScale * stoolScale + 0.05 * modelScale;
const distance = tableRadius + 0.56 * scale - 0.075;
const tile = ((8 * 4.2 + 3 * 2) * 0.049 * scale * 0.62) / 8;
const cellPosition = ({ r, c }) => new THREE.Vector3((c - 3.5) * tile, tableY + 0.022 + tile * 0.012, (r - 3.5) * tile);
const makeActor = seat => createCheckersHumanActor(template, { seat, distance: distance + (seat === 'bottom' ? 0.025 : 0), seatY: tableY - 0.12, height: tableRadius * 2.4 });

test('character selection maps to the local seat for either colour without rotating the board', () => {
  assert.equal(checkersSeatForSide('light', 'light'), 'bottom');
  assert.equal(checkersSeatForSide('dark', 'light'), 'top');
  assert.equal(checkersSeatForSide('dark', 'dark'), 'bottom');
  assert.equal(checkersSeatForSide('light', 'dark'), 'top');
  assert.equal(PHYSICAL_MOVE_DURATION_MS, CHESS_DURATION);
});

test('both actors clone the actual Chess skeleton and sit at the intended height', () => {
  const a = makeActor('bottom'), b = makeActor('top');
  assert.notEqual(a.rig.rightHand, b.rig.rightHand);
  for (const actor of [a, b]) {
    assert.equal(actor.rig.rightThumb.length, 3);
    assert.equal(actor.rig.rightIndex.length, 3);
    assert.equal(actor.rig.rightMiddle.length, 3);
    assert.ok(Math.abs(actor.rig.hips.getWorldPosition(new THREE.Vector3()).y - (tableY - 0.12)) < 1e-6);
  }
  a.rig.rightHand.rotateX(0.4);
  assert.ok(a.rig.rightHand.quaternion.angleTo(b.rig.rightHand.quaternion) > 0.3);
  disposeCheckersHuman(a); disposeCheckersHuman(b);
});

test('actual hands reach opening, centre, edge and king-row checker placements from both seats', () => {
  for (const seat of ['bottom', 'top']) {
    const actor = makeActor(seat);
    const scene = new THREE.Group(); scene.add(actor.root);
    for (const [fromCell, toCell] of [
      [{ r: 5, c: 0 }, { r: 4, c: 1 }], [{ r: 2, c: 7 }, { r: 3, c: 6 }],
      [{ r: 4, c: 1 }, { r: 2, c: 3 }], [{ r: 2, c: 3 }, { r: 0, c: 5 }],
      [{ r: 1, c: 6 }, { r: 3, c: 4 }], [{ r: 5, c: 4 }, { r: 7, c: 6 }],
      [{ r: 2, c: 3 }, { r: 0, c: 1 }], [{ r: 2, c: 5 }, { r: 0, c: 7 }],
      [{ r: 5, c: 2 }, { r: 7, c: 0 }]
    ]) {
      idleCheckersHuman(actor);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(tile * 0.32, tile * 0.32, tile * 0.16), new THREE.MeshBasicMaterial());
      scene.add(mesh);
      const action = { mesh, from: cellPosition(fromCell), to: cellPosition(toCell), fromCell, toCell };
      for (let frame = 0; frame <= 40; frame++) {
        const u = frame / 40;
        updateCheckersHumanMove(actor, action, u, tile);
        if (u <= 0.3) assert.ok(mesh.position.distanceTo(action.from) < 1e-9, 'piece lifted before grip');
        if (u >= 0.82) assert.ok(mesh.position.distanceTo(action.to) < 1e-9, 'piece failed to land');
        if (u >= 0.3 && u <= 0.8) {
          const contact = mesh.position.clone().add(new THREE.Vector3(0, action.gripHeight, 0));
          const hand = actor.rig.rightHand.localToWorld(action.gripAnchorLocal.clone());
          assert.ok(hand.distanceTo(contact) < tile * 0.18, `${seat} ${JSON.stringify(toCell)} at ${u}: hand missed by ${hand.distanceTo(contact) / tile} tiles`);
        }
      }
      scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose();
    }
    disposeCheckersHuman(actor);
  }
});

test('portrait first-person view keeps the real skinned hands and restores the full body in 2D', () => {
  const actor = makeActor('bottom');
  assert.ok(actor.firstPerson.arms.length > 0, 'actual model has no first-person arms');
  setCheckersHumanView(actor, '3d');
  assert.ok(actor.firstPerson.originals.every(mesh => !mesh.visible));
  assert.ok(actor.firstPerson.arms.every(mesh => mesh.visible && mesh.geometry.index.count > 0));
  assert.ok(actor.firstPerson.arms.some(mesh => mesh.skeleton.bones.includes(actor.rig.rightHand)));
  setCheckersHumanView(actor, '2d');
  assert.ok(actor.firstPerson.originals.every(mesh => mesh.visible));
  assert.ok(actor.firstPerson.arms.every(mesh => !mesh.visible));
  const originalGeometry = actor.firstPerson.originals[0].geometry;
  let disposedOriginal = false;
  originalGeometry.addEventListener('dispose', () => { disposedOriginal = true; });
  disposeCheckersHuman(actor);
  assert.equal(disposedOriginal, false, 'shared template geometry must survive a character change');
});

test('portrait framing keeps the opponent head and all four board corners on screen', () => {
  const actor = makeActor('top');
  const crown = actor.rig.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.15, 0));
  for (const aspect of [320 / 680, 390 / 760, 9 / 14, 1]) {
    const camera = new THREE.PerspectiveCamera(checkersPortraitFov(aspect), aspect, 0.1, 100);
    camera.position.set(0, tableY + 2.05 * scale, tableRadius * 0.98 * 1.06);
    camera.lookAt(0, tableY + CHECKERS_HUMAN_CAMERA_TARGET_HEIGHT * scale, 0);
    camera.updateMatrixWorld(true);
    const points = [crown];
    for (const x of [-tile * 4, tile * 4]) for (const z of [-tile * 4, tile * 4]) points.push(new THREE.Vector3(x, tableY + 0.022, z));
    for (const point of points) {
      const projected = point.clone().project(camera);
      assert.ok(Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1, `clipped at aspect ${aspect}: ${projected.toArray()}`);
    }
  }
  disposeCheckersHuman(actor);
});

test('fallback follows the same planted, carried and released timing when a model is unavailable', () => {
  const mesh = new THREE.Object3D();
  const action = { mesh, from: cellPosition({ r: 5, c: 0 }), to: cellPosition({ r: 4, c: 1 }), fromCell: { r: 5, c: 0 }, toCell: { r: 4, c: 1 } };
  updateCheckersHumanMove(undefined, action, 0.2, tile);
  assert.ok(mesh.position.equals(action.from));
  updateCheckersHumanMove(undefined, action, 1, tile);
  assert.ok(mesh.position.distanceTo(action.to) < 1e-9);
});
