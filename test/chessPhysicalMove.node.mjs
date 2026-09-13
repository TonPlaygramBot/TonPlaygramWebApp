import test from 'node:test';
import {
  calibrateHandRig,
  applyHandGrip,
  solveFingerContact
} from '../webapp/src/games/chess/anatomicalHand.ts';
import assert from 'node:assert/strict';
import { loadRig } from './chessAvatarFixture.mjs';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import {
  samplePhysicalMove,
  rotateJointToTarget,
  normalizeRigBoneName,
  updatePhysicalPieceMove,
  tipPosition
} from '../webapp/src/games/chess/physicalPieceMove.ts';

test('piece stays planted while reaching/gripping and fingers stay closed until touchdown', () => {
  const from = new THREE.Vector3(-1, 2, 3),
    to = new THREE.Vector3(4, 2, -3);
  for (const t of [0, 0.1, 0.2, 0.29, 0.3])
    assert.ok(samplePhysicalMove(t, from, to, 0.4).position.equals(from));
  for (const t of [0.35, 0.5, 0.7, 0.81])
    assert.equal(samplePhysicalMove(t, from, to, 0.4).grip, 1);
  for (const t of [0.82, 0.86, 0.9, 1])
    assert.ok(
      samplePhysicalMove(t, from, to, 0.4).position.distanceTo(to) < 1e-10
    );
  assert.equal(samplePhysicalMove(1, from, to, 0.4).grip, 0);
  for (let i = 1; i <= 1000; i++)
    assert.ok(
      samplePhysicalMove(i / 1000, from, to, 0.4).position.distanceTo(
        samplePhysicalMove((i - 1) / 1000, from, to, 0.4).position
      ) < 0.05
    );
});
test('joint solver gives the same pose for either seat and a scaled, rotated parent', () => {
  function solve(rotation, scale) {
    const root = new THREE.Group();
    root.rotation.set(0.2, rotation, 0.1);
    root.scale.setScalar(scale);
    root.position.set(3, 4, -2);
    const bone = new THREE.Bone(),
      tip = new THREE.Bone();
    tip.position.set(0, 1, 0);
    root.add(bone);
    bone.add(tip);
    root.updateMatrixWorld(true);
    const target = root.localToWorld(new THREE.Vector3(0.6, 0.8, 0));
    for (let i = 0; i < 20; i++)
      rotateJointToTarget(
        bone,
        tip.getWorldPosition(new THREE.Vector3()),
        target
      );
    return {
      q: bone.quaternion,
      error:
        tip.getWorldPosition(new THREE.Vector3()).distanceTo(target) / scale
    };
  }
  const a = solve(0, 1),
    b = solve(Math.PI, 3.2);
  assert.ok(a.error < 1e-6);
  assert.ok(b.error < 1e-6);
  assert.ok(a.q.angleTo(b.q) < 1e-6);
});
test('the actual chess avatar resolves all three thumb/index/middle joints', () => {
  const { rig } = loadRig();
  for (const name of [
    'rightThumb',
    'rightIndex',
    'rightMiddle',
    'leftThumb',
    'leftIndex',
    'leftMiddle'
  ])
    assert.equal(rig[name].length, 3, name);
  assert.equal(rig.rightHand.name, 'RightHand');
  assert.equal(rig.rightUpperArm.name, 'RightArm');
  assert.equal(
    normalizeRigBoneName('mixamorig:RightHandIndex1'),
    'mixamorigrightindex1'
  );
});
test('actual avatar thumb/index contact survives translated/scaled board parents', () => {
  const { root, rig } = loadRig();
  root.rotation.y = Math.PI;
  root.scale.setScalar(3.2);
  root.updateMatrixWorld(true);
  const parent = new THREE.Group();
  parent.position.set(7, 2, -5);
  parent.scale.setScalar(0.6);
  parent.rotation.y = 0.4;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.015, 0.08),
    new THREE.MeshBasicMaterial()
  );
  parent.add(mesh);
  parent.updateMatrixWorld(true);
  const pinch = [rig.rightThumb, rig.rightIndex, rig.rightMiddle]
    .map(tipPosition)
    .reduce((a, b) => a.add(b), new THREE.Vector3())
    .multiplyScalar(1 / 3);
  const from = parent.worldToLocal(pinch.clone());
  from.y -= 0.08;
  const to = from.clone().add(new THREE.Vector3(0.04, 0, 0.03));
  const action = { mesh, from, to, gripHeight: 0.08, gripRadius: 0.006 };
  updatePhysicalPieceMove(rig, action, 0.5, 0.03);
  assert.ok(
    mesh.position.distanceTo(samplePhysicalMove(0.5, from, to, 0.03).position) <
      1e-10
  );
  const target = parent.localToWorld(
    mesh.position.clone().add(new THREE.Vector3(0, 0.08, 0))
  );
  for (const chain of [rig.rightThumb, rig.rightIndex]) {
    const tip = tipPosition(chain);
    assert.ok(tip.toArray().every(Number.isFinite));
    assert.ok(
      tip.distanceTo(target) < 0.035,
      `Fingertip is ${tip.distanceTo(target)} from the piece neck`
    );
  }
  updatePhysicalPieceMove(rig, action, 1, 0.03);
  assert.ok(mesh.position.distanceTo(to) < 1e-10);
});

test('all four fingers curl into each palm and both hands remain mirrored', () => {
  const { rig } = loadRig();
  const before = new Map();
  for (const side of ['left', 'right'])
    for (const digit of ['Index', 'Middle', 'Ring', 'Pinky'])
      before.set(
        side + digit,
        rig[side + 'Hand'].worldToLocal(tipPosition(rig[side + digit])).z
      );
  for (const side of ['left', 'right']) applyHandGrip(rig, side, 0.2);
  for (const side of ['left', 'right'])
    for (const digit of ['Index', 'Middle', 'Ring', 'Pinky']) {
      // Independent asset fact: the palm side of this GLB is hand-local +Z.
      assert.ok(
        rig[side + 'Hand'].worldToLocal(tipPosition(rig[side + digit])).z >
          before.get(side + digit) + 0.01,
        side + digit
      );
    }
  for (const grip of [0, 0.25, 0.5, 0.75, 1]) {
    for (const side of ['left', 'right']) applyHandGrip(rig, side, grip);
    for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const left = tipPosition(rig['left' + digit]);
      left.x *= -1;
      assert.ok(
        left.distanceTo(tipPosition(rig['right' + digit])) < 0.0001,
        digit
      );
    }
  }
});

function assertHinges(profile) {
  for (const [digit, finger] of Object.entries(profile.fingers)) {
    for (const [i, joint] of finger.joints.entries()) {
      const q = joint.bind
        .clone()
        .invert()
        .multiply(joint.bone.quaternion)
        .normalize();
      if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w);
      const axis = new THREE.Vector3(q.x, q.y, q.z);
      const angle = 2 * Math.atan2(axis.length(), q.w);
      assert.ok(Number.isFinite(angle));
      // MCP permits spread/opposition; middle and distal joints are hinges.
      if (i > 0 && angle > 1e-7) {
        assert.ok(
          axis.normalize().dot(joint.flexAxis) > 0.999999,
          `${digit}${i}: twist or backward bend`
        );
        assert.ok(
          angle <= joint.maxFlex + 1e-7,
          `${digit}${i}: excessive flexion`
        );
      }
      assert.ok(joint.flex >= 0 && joint.flex <= joint.maxFlex);
      assert.ok(Math.abs(joint.spread) <= joint.maxSpread);
      assert.ok(
        joint.opposition >= 0 && joint.opposition <= joint.maxOpposition
      );
    }
    if (!finger.thumb)
      assert.ok(
        Math.abs(finger.joints[2].flex - 0.65 * finger.joints[1].flex) < 1e-9,
        'smooth middle/distal curl'
      );
  }
}

test('unreachable targets cannot hyperextend or twist any digit on either hand', () => {
  const { rig } = loadRig();
  const profiles = calibrateHandRig(rig);
  for (const side of ['left', 'right']) {
    const profile = profiles[side];
    for (const targetLocal of [
      [0, -2, -2],
      [4, 0, 0],
      [-4, 0, 0],
      [0, 3, 0]
    ]) {
      applyHandGrip(rig, side, 0.5);
      const target = profile.hand.localToWorld(
        new THREE.Vector3(...targetLocal)
      );
      for (const finger of Object.values(profile.fingers))
        solveFingerContact(finger, target, 30);
      assertHinges(profile);
    }
  }
});

test('calibration survives rolled bone frames and opposite, scaled seats', () => {
  function pose(roll, yaw, scale) {
    let { root, rig } = loadRig();
    for (const side of ['left', 'right'])
      for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
        for (const bone of rig[side + digit]) {
          const q = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            roll
          );
          bone.quaternion.multiply(q);
          for (const child of bone.children) {
            child.position.applyQuaternion(q.clone().invert());
            child.quaternion.premultiply(q.clone().invert());
          }
        }
      }
    root.rotation.set(0.13, yaw, 0.21);
    root.scale.setScalar(scale);
    root.position.set(3, 2, -1);
    ({ rig } = loadRig(root));
    for (const side of ['left', 'right']) applyHandGrip(rig, side, 0.7);
    const tips = [];
    for (const side of ['left', 'right'])
      for (const digit of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'])
        tips.push(root.worldToLocal(tipPosition(rig[side + digit])));
    return tips;
  }
  const baseline = pose(0, 0, 1),
    rolled = pose(1.7, Math.PI, 3.2);
  baseline.forEach((p, i) =>
    assert.ok(p.distanceTo(rolled[i]) < 1e-6, `digit ${i}`)
  );
});

test('actual seated pickup has continuous joints through grip, carry, release and withdrawal', () => {
  for (const yaw of [0, Math.PI]) {
    const { root, rig, pose } = loadRig();
    root.rotation.y = yaw;
    pose('idle', 1, 0);
    root.updateMatrixWorld(true);
    const contact = [rig.rightThumb, rig.rightIndex, rig.rightMiddle]
      .map(tipPosition)
      .reduce((sum, p) => sum.add(p), new THREE.Vector3())
      .multiplyScalar(1 / 3);
    const from = contact
      .clone()
      .add(
        new THREE.Vector3(0.045, -0.065, 0.055).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          yaw
        )
      );
    const to = from
      .clone()
      .add(
        new THREE.Vector3(0.09, 0, 0.12).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          yaw
        )
      );
    const parent = new THREE.Group(),
      mesh = new THREE.Object3D();
    parent.add(mesh);
    const action = { mesh, from, to, gripHeight: 0.032, gripRadius: 0.009 };
    const profile = calibrateHandRig(rig).right;
    const joints = Object.values(profile.fingers).flatMap((f) => f.joints);
    let previous;
    for (let i = 0; i <= 400; i++) {
      const u = i / 400,
        f = samplePhysicalMove(u, from, to, 0.045);
      pose('reachPiece', f.reach, f.grip, { forwardReach: 0.05, sideReach: 0 });
      updatePhysicalPieceMove(rig, action, u, 0.045);
      assertHinges(profile);
      if (previous)
        joints.forEach((j, k) =>
          assert.ok(
            j.bone.quaternion.angleTo(previous[k]) < 0.08,
            `${j.bone.name} snapped at ${u}`
          )
        );
      previous = joints.map((j) => j.bone.quaternion.clone());
      if (u >= 0.3 && u <= 0.82) {
        const target = mesh.position
          .clone()
          .add(new THREE.Vector3(0, 0.032, 0));
        const anchor = rig.rightHand.localToWorld(
          action.gripAnchorLocal.clone()
        );
        assert.ok(
          anchor.distanceTo(target) < 0.008,
          `wrist lost the piece at ${u}`
        );
      }
    }
    for (const j of joints)
      assert.ok(
        j.bind.angleTo(j.bone.quaternion) < 1e-7,
        'release returns to rest'
      );
    assert.ok(mesh.position.distanceTo(to) < 1e-10);
  }
});

test('distal extension follows a rolled terminal joint when no fingertip bone is present', () => {
  const base = new THREE.Bone(),
    last = new THREE.Bone();
  base.add(last);
  last.position.set(0, 0.03, 0);
  last.rotation.y = 1.2;
  const chain = [base, last];
  const before = tipPosition(chain);
  last.rotateX(0.5);
  const after = tipPosition(chain);
  assert.ok(before.distanceTo(after) > 0.005);
  assert.ok(
    Math.abs(
      after.distanceTo(last.getWorldPosition(new THREE.Vector3())) - 0.0216
    ) < 1e-9
  );
});
