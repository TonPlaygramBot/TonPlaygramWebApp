import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { clone } from '../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { loadCheckersHumanTemplate } from './checkersHumanFixture.mjs';
import { calibrateHandRig, tipPosition } from '../webapp/src/games/chess/anatomicalHand.ts';
import { createLudoDiceHand, createLudoDiceContact, createLudoDiceThrow, updateLudoDiceThrow, sampleLudoDiceThrow, LUDO_DICE_TIMING } from '../webapp/src/utils/ludoDiceMotion.ts';

// Exercise the actual Ludo seated pose on the bundled skinned human, including
// seat rotation and a transformed board parent. No synthetic skeleton lengths.
const source = readFileSync(new URL('../webapp/src/pages/Games/LudoBattleRoyal.jsx', import.meta.url), 'utf8');
const between = (a, b) => source.slice(source.indexOf(a), source.indexOf(b));
const { saveBoneRig, applySeatedHumanPose } = Function('THREE', `
const clamp = THREE.MathUtils.clamp;
const SEATED_HUMAN_MOTION_TUNING = { idleBreathAmp: 0 };
${between('const SEATED_HUMAN_DOWNWARD_CONTACT_MODE_SET', 'const SEATED_HELPER_FORWARD_DICE_PICKUP')}
${between('function normalizeBoneName(', 'const SEATED_HUMAN_TEXTURE_PROFILES')}
${between('const FRONT_SIDE_Z', 'function alignSeatedHumanFeetToGroundPlane(')}
return { saveBoneRig, applySeatedHumanPose };
`)(THREE);
const template = await loadCheckersHumanTemplate();
const world = (node) => node.getWorldPosition(new THREE.Vector3());
function fixture(seat = 0, scale = 1, face = [0, 0, 0]) {
  const scene = new THREE.Group();
  scene.position.set(0.3, 0.12, -0.2); scene.rotation.y = 0.17; scene.scale.setScalar(scale);
  const root = new THREE.Group(); root.rotation.y = seat * Math.PI / 2; scene.add(root);
  const actor = clone(template); actor.scale.setScalar(0.8); root.add(actor);
  const rig = saveBoneRig(actor), binding = createLudoDiceHand(rig);
  const idle = () => { applySeatedHumanPose(rig, 'idle', 1, 0, {}, { idleBreathAmp: 0 }); scene.updateMatrixWorld(true); };
  idle();
  const shoulder = root.worldToLocal(world(rig.rightUpperArm));
  const dice = new THREE.Object3D(); scene.add(dice);
  dice.rotation.set(...face);
  dice.position.copy(scene.worldToLocal(root.localToWorld(shoulder.add(new THREE.Vector3(0.025, -0.22, 0.27)))));
  const destination = dice.position.clone().add(new THREE.Vector3(0.12, 0, 0.14));
  const contact = createLudoDiceContact(binding, dice, 0.054);
  assert.ok(contact && binding.pinch, 'actual hand must have a calibrated pinch');
  return { scene, actor, rig, binding, dice, contact, destination, idle };
}

test('die remains planted through reach and closure, with a continuous lift and release', () => {
  const start = new THREE.Vector3(1, 2, 3), forward = new THREE.Vector3(0, 0, 1);
  for (let ms = 0; ms <= LUDO_DICE_TIMING.close; ms += 10) {
    assert.ok(sampleLudoDiceThrow(ms, start, forward, 0.054).position.equals(start));
  }
  for (const ms of Object.values(LUDO_DICE_TIMING)) {
    const a = sampleLudoDiceThrow(ms - 0.01, start, forward, 0.054);
    const b = sampleLudoDiceThrow(ms + 0.01, start, forward, 0.054);
    assert.ok(a.position.distanceTo(b.position) < 1e-5, `position jumps at ${ms}`);
    assert.ok(Math.abs(a.grip - b.grip) < 0.001, `grip jumps at ${ms}`);
  }
});

test('real fingers and arm reach the die from all four seats without moving the actor or stretching bones', () => {
  for (const seat of [0, 1, 2, 3]) {
    const f = fixture(seat, seat % 2 ? 0.72 : 1);
    const { rig, dice, contact, actor, idle, destination } = f;
    const original = rig.bones.map((bone) => bone.position.clone());
    const root = actor.position.clone(), start = dice.position.clone();
    const action = createLudoDiceThrow(contact, dice, destination);
    for (const ms of [0, 120, 280, 440, 540, 660, 840, 940, 1040, 1200, 1580]) {
      idle(); updateLudoDiceThrow(action, ms);
      if (ms <= 440) assert.ok(dice.position.distanceTo(start) < 1e-9, 'pickup changed the dice location');
      if (ms >= 440 && ms <= 940) {
        const center = world(dice);
        const anchor = rig.rightHand.localToWorld(contact.anchor.clone());
        assert.ok(anchor.distanceTo(center) < contact.size * 0.08, `seat ${seat} at ${ms}: missed by ${anchor.distanceTo(center) / contact.size} dice`);
        if (ms === 660) {
          for (const digit of ['rightThumb', 'rightIndex']) {
            const tip = tipPosition(rig[digit].slice(0, 3));
            const error = Math.abs(tip.distanceTo(center) - contact.size / 2);
            assert.ok(error < contact.size * 0.25, `${digit} misses cube surface by ${error / contact.size}`);
          }
        }
      }
      rig.bones.forEach((bone, i) => assert.ok(bone.position.distanceTo(original[i]) < 1e-9, `${bone.name} was stretched`));
      assert.ok(actor.position.equals(root));
      rig.bones.forEach((bone) => assert.ok(bone.quaternion.toArray().every(Number.isFinite)));
    }
  }
});

test('dropped frames release at the exact sampled position and follow-through never owns the free die', () => {
  const { idle, contact, dice, destination } = fixture();
  const action = createLudoDiceThrow(contact, dice, destination);
  idle(); updateLudoDiceThrow(action, 1600);
  const release = sampleLudoDiceThrow(LUDO_DICE_TIMING.release, action.start, action.forward, contact.size).position;
  assert.ok(world(dice).distanceTo(release) < 1e-9);
  dice.position.copy(destination);
  idle(); updateLudoDiceThrow(action, 1700);
  assert.ok(dice.position.equals(destination));
});

test('the palm faces the table and fingers continue past the wrist for every seat and die face', () => {
  const halfTurn = Math.PI, quarterTurn = Math.PI / 2;
  const faces = [[0, 0, 0], [quarterTurn, 0, 0], [-quarterTurn, 0, 0], [halfTurn, 0, 0], [0, 0, quarterTurn], [0, 0, -quarterTurn]];
  for (const seat of [0, 1, 2, 3]) {
    let referenceGrip;
    for (const face of faces) {
      const { rig, binding, contact, dice, destination, idle } = fixture(seat, seat % 2 ? 0.72 : 1, face);
      const profile = calibrateHandRig(binding.rig).right;
      const forward = world(dice).sub(world(rig.rightUpperArm)).setY(0).normalize();
      const diceQ = dice.quaternion.clone();
      if (referenceGrip) assert.ok(referenceGrip.angleTo(contact.gripQ) < 1e-6, 'a new rolled face must not flip the wrist');
      referenceGrip = contact.gripQ.clone();
      const action = createLudoDiceThrow(contact, dice, destination);
      for (const ms of [440, 660, 840, 1040]) {
        idle(); updateLudoDiceThrow(action, ms);
        const handQ = rig.rightHand.getWorldQuaternion(new THREE.Quaternion());
        const fingers = profile.forward.clone().applyQuaternion(handQ);
        const palm = profile.inward.clone().applyQuaternion(handQ);
        const forearm = world(rig.rightHand).sub(world(rig.rightForeArm)).normalize();
        assert.ok(fingers.dot(forward) > 0.9, `seat ${seat}: fingers point backward at ${ms}`);
        assert.ok(palm.y < -0.9, `seat ${seat}: palm twisted away from the table at ${ms}`);
        assert.ok(fingers.dot(forearm) > 0.1, `seat ${seat}: wrist folds back over the arm at ${ms}`);
        assert.ok(dice.quaternion.angleTo(diceQ) < 1e-6, 'hand correction rotated the die');
      }
    }
  }
});

test('incomplete rigs fall back without a crash or any dice relocation', () => {
  const binding = createLudoDiceHand({});
  const dice = new THREE.Object3D(); new THREE.Group().add(dice);
  dice.position.set(1, 2, 3);
  assert.equal(createLudoDiceContact(binding, dice, 0.054), undefined);
  assert.deepEqual(dice.position.toArray(), [1, 2, 3]);
});
