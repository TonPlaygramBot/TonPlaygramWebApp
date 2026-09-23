import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { PoolRoyalHumanPlayers } from '../webapp/src/pages/Games/shared/PoolRoyalHumanPlayers.ts';
import { PoolRoyalShotCamera } from '../webapp/src/pages/Games/shared/poolRoyalShotCamera.ts';
import { bridgeSkinBounds, bridgeCueClearance } from '../webapp/src/pages/Games/shared/poolRoyalPlayerPose.ts';
import { poolRoyalHandContact } from '../webapp/src/pages/Games/shared/poolRoyalHandContact.ts';
import { createShowoodTableGeometry } from '../webapp/src/pages/Games/shared/poolRoyaleShowoodGeometry.js';
import { readPoolRoyalMetrics } from '../scripts/read-pool-royal-metrics.mjs';
import { loadPoseModel } from './fixtures/poolRoyalPoseTrace.mjs';

const metrics = await readPoolRoyalMetrics();
const frame = { activeSeat: 'A', state: 'dragging', power: 0, nowMs: 1000,
  cueBall: new THREE.Vector3(0, metrics.ballY, metrics.tableL * 0.31),
  aimForward: new THREE.Vector3(0, 0, -1) };
const settle = (players, input = frame, count = 100) => {
  for (let i = 0; i < count; i++) players.update(1 / 60, input);
  players.group.updateWorldMatrix(true, true);
};

test('detailed hands preserve avatar size, valid skinning, UVs and the original shared asset', async () => {
  const model = await loadPoseModel();
  const source = model.getObjectByName('Wolf3D_Body').geometry;
  const original = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...metrics, model });
  const detailed = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...metrics, model, realisticMovement: true });
  assert.ok(await original.ready); assert.ok(await detailed.ready);
  assert.ok(Math.abs(original.referenceScale - detailed.referenceScale) < 1e-10,
    'adding nail skin cannot change character-height calibration');
  for (const player of detailed.players) {
    const body = player.human.model.getObjectByName('Wolf3D_Body');
    assert.notEqual(body.geometry, source);
    assert.ok(body.geometry.attributes.position.count > source.attributes.position.count * 2);
    assert.ok(body.geometry.attributes.position.count < 5000, 'bounded mobile geometry budget');
    const nails = player.human.model.getObjectByName('PoolRoyalFingernails');
    assert.equal(nails.geometry.attributes.position.count, 130, 'ten fitted nails, one draw');
    for (const mesh of [body, nails]) {
      const { position, normal, skinIndex, skinWeight } = mesh.geometry.attributes;
      assert.equal(position.count, skinIndex.count); assert.equal(position.count, skinWeight.count);
      for (const attribute of Object.values(mesh.geometry.attributes)) {
        assert.ok([...attribute.array].every(Number.isFinite));
      }
      for (let i = 0; i < position.count; i++) {
        let total = 0;
        for (let j = 0; j < 4; j++) {
          total += skinWeight.getComponent(i, j);
          assert.ok(skinIndex.getComponent(i, j) < mesh.skeleton.bones.length);
        }
        assert.ok(Math.abs(total - 1) < 1e-6);
        assert.ok(new THREE.Vector3().fromBufferAttribute(normal, i).length() > 0.99);
      }
      assert.ok([...mesh.geometry.index.array].every(index => index < position.count));
    }
    const bounds = new THREE.Box3().setFromObject(player.human.modelRoot);
    const nailBounds = new THREE.Box3().setFromObject(nails);
    assert.ok(bounds.containsBox(nailBounds));
  }
  assert.equal(model.getObjectByName('Wolf3D_Body').geometry, source);
  assert.equal(source.attributes.position.count, 1108);
  original.dispose(); detailed.dispose();
});

test('the rendered shaft touches the bridge without piercing it on four rails and an oblique shot', async () => {
  const now = performance.now; performance.now = () => 1000;
  try {
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.65]) {
      const players = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...metrics, model: await loadPoseModel(), realisticMovement: true });
      assert.ok(await players.ready);
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      const half = Math.min(metrics.tableW / 2 / Math.max(1e-8, Math.abs(forward.x)),
        metrics.tableL / 2 / Math.max(1e-8, Math.abs(forward.z)));
      const ball = forward.clone().multiplyScalar(-(half - metrics.tableW * 0.15)).setY(metrics.ballY);
      const axis = forward.clone().add(new THREE.Vector3(0, -metrics.cueButtLift / metrics.cueLength, 0)).normalize();
      for (const spinHeight of [-0.34, 0, 0.35]) {
        let planted;
        for (const power of [0, 0.5, 1]) {
          const tip = ball.clone().addScaledVector(forward, -metrics.cueGap)
            .add(new THREE.Vector3(0, metrics.ballR * spinHeight, 0))
            .addScaledVector(axis, -metrics.cuePull * power);
          const back = tip.clone().addScaledVector(axis, -metrics.cueLength);
          const radius = metrics.ballR / 0.0525 * (0.008 + 0.017 * 0.28);
          settle(players, { ...frame, aimForward: forward, cueBall: ball, power, cueBack: back, cueTip: tip, cueRadius: radius });
          const human = players.players[0].human;
          const clothGap = bridgeSkinBounds(human).min.y - metrics.clothY;
          const shaftGap = bridgeCueClearance(human, { back, tip, radius });
          assert.ok(clothGap > -0.01 && clothGap < metrics.ballR * 0.1, `cloth ${clothGap} yaw ${yaw}`);
          assert.ok(shaftGap >= -0.005 && shaftGap < metrics.ballR * 0.055,
            `shaft ${shaftGap} yaw ${yaw} spin ${spinHeight} power ${power}`);
          const wrist = human.bones.leftHand.getWorldPosition(new THREE.Vector3());
          if (planted) assert.ok(wrist.distanceTo(planted) < metrics.ballR * 0.04, 'the cue slides through a planted bridge');
          planted = wrist;
        }
      }
      players.dispose();
    }
  } finally { performance.now = now; }
});

test('the aiming lens is exactly between the eyes under a rotated/scaled parent for both seats', async () => {
  const parent = new THREE.Group(); parent.position.set(11, -20, 6); parent.scale.setScalar(0.21); parent.rotation.y = 0.7;
  const players = new PoolRoyalHumanPlayers(parent, { ...metrics, model: await loadPoseModel(), realisticMovement: true });
  assert.ok(await players.ready);
  for (const activeSeat of ['A', 'B']) {
    settle(players, { ...frame, activeSeat }, 450);
    const human = players.players.find(player => player.seat === activeSeat).human;
    const middle = human.model.getObjectByName('LeftEye').getWorldPosition(new THREE.Vector3())
      .lerp(human.model.getObjectByName('RightEye').getWorldPosition(new THREE.Vector3()), 0.5);
    const cameraPosition = parent.localToWorld(players.eyeView.position.clone());
    assert.ok(cameraPosition.distanceTo(middle) < 1e-8, 'no forward offset from the eyes');
    const camera = new PoolRoyalShotCamera(0.55);
    const pose = camera.resolve({ eye: players.eyeView, stroke: false, shooting: false, cueBlend: 0.5, now: 0 });
    assert.equal(pose.blend, 1, 'settled player view reaches the eyes before the orbit limit');
    assert.equal(camera.resolve({ eye: players.eyeView, stroke: false, shooting: false, cueBlend: 0, now: 0, excluded: true }), null);
  }
  players.dispose();
});

test('the complete bridge clears cloth, rail edges, corners and balls throughout address, pullback, strike and recovery', async () => {
  const m = metrics, geometry = createShowoodTableGeometry({ playWidth: m.playW, playLength: m.playL, ballRadius: m.ballR });
  const model = await loadPoseModel();
  for (const [name, x, z, yaw, crowded, tilt = 0] of [
    ['open', 0, m.tableL * 0.31, 0],
    ['end rail', 0, m.playL / 2 - m.ballR * 1.3, 0],
    ['side rail', m.playW / 2 - m.ballR * 1.3, 0, Math.PI / 2],
    ['corner', m.playW / 2 - m.ballR * 1.4, m.playL / 2 - m.ballR * 1.4, Math.PI / 4],
    ['crowded', 0, m.tableL * 0.31, 0, true],
    ['long reach', 0, -m.tableL * 0.31, 0],
    ['elevated cue', 0, m.tableL * 0.31, 0, false, 0.23]
  ]) {
    const players = new PoolRoyalHumanPlayers(new THREE.Scene(), { ...m, model, realisticMovement: true,
      tableW: geometry.footprint.width, tableL: geometry.footprint.length,
      targetHeight: Math.max(Math.max(m.tableW, m.tableL) * 0.82, (m.clothY - m.floorY) * 1.8) });
    assert.ok(await players.ready);
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    const ball = new THREE.Vector3(x, m.ballY, z);
    const tip = ball.clone().addScaledVector(forward, -m.cueGap).add(new THREE.Vector3(0, -m.ballR * 0.34, 0));
    const back = tip.clone().addScaledVector(forward, -m.cueLength).setY(tip.y + m.cueButtLift + Math.sin(tilt) * m.cueLength);
    const obstacles = [{ position: ball, radius: m.ballR }];
    if (crowded) for (const dx of [-2, 0, 2]) for (const dz of [3, 5, 7]) {
      obstacles.push({ position: ball.clone().add(new THREE.Vector3(dx * m.ballR, 0, dz * m.ballR)), radius: m.ballR });
    }
    const input = { ...frame, cueBall: ball, aimForward: forward, cueTip: tip, cueBack: back,
      cueRadius: m.ballR / 0.0525 * (0.008 + 0.017 * 0.28),
      bridgeBounds: { halfWidth: m.playW / 2, halfLength: m.playL / 2 },
      bridgeRailY: m.clothY + m.railH, bridgeObstacles: obstacles };
    const scale = players.referenceScale;
    const toReference = vector => vector.clone().sub(new THREE.Vector3(0, m.floorY, 0)).divideScalar(scale);
    const scene = { clothY: (m.clothY - m.floorY) / scale, railY: (m.clothY + m.railH - m.floorY) / scale,
      inner: { halfWidth: m.playW / 2 / scale, halfLength: m.playL / 2 / scale },
      outer: { halfWidth: geometry.footprint.width / 2 / scale, halfLength: geometry.footprint.length / 2 / scale },
      balls: obstacles.map(obstacle => ({ position: toReference(obstacle.position), radius: m.ballR / scale })) };
    const shooter = players.players[0];
    const check = () => {
      players.solverScene.add(shooter.human.modelRoot);
      players.solverScene.updateMatrixWorld(true);
      const contact = poolRoyalHandContact(shooter.human, scene);
      players.group.add(shooter.human.modelRoot);
      assert.equal(contact.clear, true, `${name} ${input.state} pose=${shooter.human.poseT} lift=${contact.lift}`);
    };
    for (let i = 0; i < 110; i++) { players.update(1 / 60, input); check(); }
    assert.equal(players.readyToShoot, true, `${name} can settle and shoot`);
    const rest = shooter.reachEquipment.group.visible;
    if (!rest) {
      players.solverScene.add(shooter.human.modelRoot);
      players.solverScene.updateMatrixWorld(true);
      const gap = bridgeCueClearance(shooter.human, { back: toReference(back), tip: toReference(tip), radius: input.cueRadius / scale });
      if (name === 'open') {
        const finger = shooter.human.leftFingers.find(bone => bone.name === 'LeftHandIndex3');
        assert.equal(poolRoyalHandContact(shooter.human, { ...scene, balls: [{
          position: finger.getWorldPosition(new THREE.Vector3()), radius: m.ballR / scale
        }] }).clear, false, 'a ball intersecting an actual finger surface must be detected');
      }
      players.group.add(shooter.human.modelRoot);
      assert.ok(gap > -0.005 && gap < 0.025, `${name} safety correction keeps the cue supported: ${gap}`);
    }
    for (let i = 0; i < 16; i++) {
      input.power = i / 15;
      input.cueTip = tip.clone().addScaledVector(forward, -m.cuePull * input.power);
      input.cueBack = back.clone().addScaledVector(forward, -m.cuePull * input.power);
      players.update(1 / 60, input); check();
    }
    const strokeRest = shooter.reachEquipment.group.visible;
    input.state = 'striking';
    for (let i = 0; i < 12; i++) {
      input.cueTip = tip.clone().addScaledVector(forward, -m.cuePull * (1 - i / 11));
      input.cueBack = back.clone().addScaledVector(forward, -m.cuePull * (1 - i / 11));
      players.update(1 / 60, input); check();
      assert.equal(shooter.reachEquipment.group.visible, strokeRest, `${name} support persists for the stroke`);
    }
    input.state = 'idle';
    for (let i = 0; i < 65; i++) { players.update(1 / 60, input); check(); }
    players.dispose();
  }
});

test('only the close local face is suppressed per render camera; head meshes and shadows remain intact', async () => {
  const parent = new THREE.Scene();
  const players = new PoolRoyalHumanPlayers(parent, { ...metrics, model: await loadPoseModel(), realisticMovement: true });
  assert.ok(await players.ready); settle(players);
  const camera = new THREE.PerspectiveCamera(), broadcast = new THREE.PerspectiveCamera();
  camera.position.copy(players.eyeView.position);
  players.updateCameraVisibility(camera, players.eyeView.target, 'A');
  for (const player of players.players) for (const mesh of player.firstPerson.meshes) {
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const shader = { uniforms: {}, fragmentShader: '#include <clipping_planes_fragment>\n' };
    material.onBeforeCompile(shader, {});
    assert.match(shader.fragmentShader, /discard/);
    mesh.onBeforeRender({}, parent, camera, mesh.geometry, material, null);
    assert.equal(shader.uniforms.poolLocalFace.value, player.seat === 'A' ? 1 : 0);
    mesh.onBeforeRender({}, parent, broadcast, mesh.geometry, material, null);
    assert.equal(shader.uniforms.poolLocalFace.value, 0, 'another camera sees the complete head');
    assert.equal(mesh.visible, true); assert.equal(mesh.castShadow, true);
    camera.position.set(0, metrics.clothY + 100, 100);
    players.updateCameraVisibility(camera, players.eyeView.target, 'A');
    mesh.onBeforeRender({}, parent, camera, mesh.geometry, material, null);
    assert.equal(shader.uniforms.poolLocalFace.value, 0, 'no disappearing head while blending into broadcast');
    camera.position.copy(players.eyeView.position);
    players.updateCameraVisibility(camera, players.eyeView.target, 'A');
  }
  players.dispose();
});
