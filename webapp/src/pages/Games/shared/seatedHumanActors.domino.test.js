import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as THREE from 'three';
import {
  applySeatedHumanArmIK,
  applySeatedHumanHandTargets,
  applySeatedHumanPose,
  applySeatedHumanReachPose,
  computeSeatedHumanScale,
  createRestoredSeatedHumanActor,
  getSeatedHumanGripWorldPosition,
  saveSeatedHumanBoneRig
} from './seatedHumanActors.js';

function makeRig(yaw = 0, scale = 1) {
  const scene = new THREE.Group();
  scene.rotation.set(0.1, yaw, -0.04);
  scene.position.set(2, 0.3, -1);
  const actor = new THREE.Group();
  actor.scale.setScalar(scale);
  scene.add(actor);
  const bones = [];
  function bone(name, parent, position) {
    const result = new THREE.Bone();
    result.name = `mixamorig:${name}`;
    result.position.set(...position);
    parent.add(result);
    bones.push(result);
    return result;
  }
  for (const side of ['Left', 'Right']) {
    const sign = side === 'Left' ? -1 : 1;
    const upper = bone(`${side}Arm`, actor, [sign * 0.28, 1.4, 0]);
    const lower = bone(`${side}ForeArm`, upper, [sign * 0.4, -0.01, 0.01]);
    const hand = bone(`${side}Hand`, lower, [sign * 0.33, 0, 0.02]);
    ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].forEach((finger, index) => {
      const base = bone(`${side}Hand${finger}1`, hand, [(index - 2) * 0.025 * sign, 0, 0.07]);
      const middle = bone(`${side}Hand${finger}2`, base, [0, 0, 0.04]);
      bone(`${side}Hand${finger}3`, middle, [0, 0, 0.03]);
    });
  }
  scene.updateMatrixWorld(true);
  const rig = saveSeatedHumanBoneRig(actor);
  return { actor, scene, rig, bones };
}

function contactOptions(actor, side, grip = 0.55) {
  return {
    position: actor.localToWorld(new THREE.Vector3(side === 'left' ? -0.36 : 0.36, 1.08, 0.46)),
    approachDirection: new THREE.Vector3(0, 0, 1).transformDirection(actor.matrixWorld),
    palmNormal: new THREE.Vector3(0, -1, 0).transformDirection(actor.matrixWorld),
    grip
  };
}

test('both hands contact their surfaces under all seat rotations and actor scales', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const scale of [1, 4.35]) {
      const { actor, scene, rig, bones } = makeRig(yaw, scale);
      const actorMatrix = actor.matrixWorld.clone();
      const rootMatrix = scene.matrixWorld.clone();
      const bonePositions = bones.map((bone) => bone.position.clone());
      for (let frame = 0; frame < 8; frame += 1) {
        applySeatedHumanPose(rig, 'idle');
        const left = contactOptions(actor, 'left');
        const right = contactOptions(actor, 'right', frame / 8);
        applySeatedHumanHandTargets(rig, { left, right });
        for (const [side, options] of [['left', left], ['right', right]]) {
          const error = getSeatedHumanGripWorldPosition(rig, side).distanceTo(options.position);
          assert.ok(error < 1e-5, `${side} contact error ${error} at yaw ${yaw}, scale ${scale}`);
        }
      }
      assert.deepEqual(actor.matrixWorld.elements, actorMatrix.elements, 'actor root stays in place');
      assert.deepEqual(scene.matrixWorld.elements, rootMatrix.elements, 'seat stays in place');
      bones.forEach((bone, index) => assert.deepEqual(bone.position.toArray(), bonePositions[index].toArray(), 'bones do not stretch'));
    }
  }
});

test('right hand can leave its rack while the left hand keeps its independent contact', () => {
  const { actor, rig } = makeRig(Math.PI / 2, 4.35);
  applySeatedHumanPose(rig, 'idle');
  const left = contactOptions(actor, 'left');
  const right = contactOptions(actor, 'right');
  applySeatedHumanHandTargets(rig, { left, right });
  const leftBefore = getSeatedHumanGripWorldPosition(rig, 'left');
  const drawContact = actor.localToWorld(new THREE.Vector3(0.2, 1, 0.5));
  const result = applySeatedHumanArmIK(rig, 'right', drawContact, right);
  assert.equal(result.reachable, true);
  assert.ok(result.error < 1e-5);
  assert.ok(getSeatedHumanGripWorldPosition(rig, 'left').distanceTo(leftBefore) < 1e-8);
});

test('unreachable contact stays finite and preserves arm lengths', () => {
  const { rig } = makeRig(Math.PI, 4.35);
  const upperPosition = rig.rightUpperArm.position.clone();
  const lowerPosition = rig.rightForeArm.position.clone();
  const wristPosition = rig.rightHand.position.clone();
  const result = applySeatedHumanArmIK(rig, 'right', new THREE.Vector3(300, 20, -300), { grip: 1 });
  assert.equal(result.applied, true);
  assert.equal(result.reachable, false);
  assert.ok(Number.isFinite(result.error));
  for (const bone of [rig.rightUpperArm, rig.rightForeArm, rig.rightHand]) {
    assert.ok(bone.quaternion.toArray().every(Number.isFinite));
    assert.ok(Math.abs(bone.quaternion.length() - 1) < 1e-8);
  }
  assert.deepEqual(rig.rightUpperArm.position.toArray(), upperPosition.toArray());
  assert.deepEqual(rig.rightForeArm.position.toArray(), lowerPosition.toArray());
  assert.deepEqual(rig.rightHand.position.toArray(), wristPosition.toArray());
});

test('Mixamo Hand-prefixed finger chains are discovered on both sides', () => {
  const { rig } = makeRig();
  for (const side of ['left', 'right']) {
    for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      assert.equal(rig[`${side}${finger}`].length, 3);
    }
  }
});

test('explicit palm contact offset and zero-strength targets are respected', () => {
  const { actor, rig } = makeRig(-Math.PI / 2, 4.35);
  const options = contactOptions(actor, 'right');
  options.contactOffset = new THREE.Vector3(0, -0.02, 0.1);
  const before = rig.rightUpperArm.quaternion.clone();
  assert.equal(applySeatedHumanArmIK(rig, 'right', options.position, { ...options, strength: 0 }), null);
  assert.deepEqual(rig.rightUpperArm.quaternion.toArray(), before.toArray());
  const result = applySeatedHumanArmIK(rig, 'right', options.position, options);
  assert.ok(result.error < 1e-5);
  const actual = rig.rightHand.localToWorld(options.contactOffset.clone());
  assert.ok(actual.distanceTo(options.position) < 1e-5);
});

test('new contact solver uses RPM terminal fingertips without changing legacy grip measurement', () => {
  const { actor } = makeRig();
  for (const side of ['Left', 'Right']) {
    for (const finger of ['Thumb', 'Index', 'Middle']) {
      const terminal = new THREE.Bone();
      terminal.name = `mixamorig:${side}Hand${finger}4`;
      terminal.position.set(0, 0, 0.035);
      actor.getObjectByName(`mixamorig:${side}Hand${finger}3`).add(terminal);
    }
  }
  const rig = saveSeatedHumanBoneRig(actor);
  const target = contactOptions(actor, 'right');
  const result = applySeatedHumanArmIK(rig, 'right', target.position, target);
  const terminalContact = new THREE.Vector3();
  rig.rightContactTips.forEach((tip) => terminalContact.add(tip.getWorldPosition(new THREE.Vector3())));
  terminalContact.multiplyScalar(1 / rig.rightContactTips.length);
  assert.ok(result.error < 1e-5);
  assert.ok(terminalContact.distanceTo(target.position) < 1e-5);
  assert.ok(getSeatedHumanGripWorldPosition(rig).distanceTo(target.position) > 0.01,
    'legacy getter continues reporting final articulated finger joints');
});

// Read the actual shipped RPM node transforms and renderable POSITION bounds.
// Materials/textures are unnecessary for verifying the real skeletal reach.
function makeActualDominoRig(seat) {
  const bytes = readFileSync(new URL('../../../../public/assets/pool-royale/readyplayer.me.glb', import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const joints = new Set(gltf.skins.flatMap((skin) => skin.joints));
  const nodes = gltf.nodes.map((node, index) => {
    const object = joints.has(index) ? new THREE.Bone() : new THREE.Group();
    object.name = node.name || '';
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    if (node.mesh != null) gltf.meshes[node.mesh].primitives.forEach((primitive) => {
      const bounds = gltf.accessors[primitive.attributes.POSITION];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([...bounds.min, ...bounds.max], 3));
      object.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
    });
    return object;
  });
  gltf.nodes.forEach((node, index) => (node.children || []).forEach((child) => nodes[index].add(nodes[child])));
  const template = new THREE.Group();
  gltf.scenes[0].nodes.forEach((index) => template.add(nodes[index]));
  template.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(template);
  template.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
  template.updateMatrixWorld(true);
  template.userData.seatedHumanScale = computeSeatedHumanScale(template, 1.13);
  const radii = [3.39418125, 2.55028125, 3.12418125, 2.55028125];
  const angle = [Math.PI / 2, 0, Math.PI * 1.5, Math.PI][seat];
  const chair = new THREE.Group();
  chair.position.set(Math.cos(angle) * radii[seat], 0, Math.sin(angle) * radii[seat]);
  chair.lookAt(0, 0, 0);
  chair.updateMatrixWorld(true);
  return { ...createRestoredSeatedHumanActor(template, chair, { targetHeight: 1.13, seatHeight: 0.69017025 }), chair };
}

test('actual RPM action reach improves table contact with hips and seat fixed and bounded arm adjustment', (context) => {
  const diagnostics = [];
  for (let seat = 0; seat < 4; seat += 1) {
    const { actor, chair, rig } = makeActualDominoRig(seat);
    applySeatedHumanPose(rig, 'placePiece');
    const rootBefore = actor.position.clone();
    const hipsBefore = rig.hips.getWorldPosition(new THREE.Vector3());
    const chairBefore = chair.position.clone();
    const lowerBefore = rig.rightForeArm.position.clone();
    const handBefore = rig.rightHand.position.clone();
    const contactSide = rig.rightUpperArm.getWorldPosition(new THREE.Vector3()).x > 0 ? 1 : -1;
    const target = new THREE.Vector3(contactSide * 0.06232, 0.70892, -0.0145);
    const options = { grip: 0.8, approachDirection: new THREE.Vector3(-contactSide, 0, 0), palmNormal: new THREE.Vector3(0, 1, 0), maxArmExtension: 1.18 };
    const before = { ...applySeatedHumanArmIK(rig, 'right', target, { ...options, maxArmExtension: 1 }) };
    applySeatedHumanPose(rig, 'placePiece');
    const result = applySeatedHumanReachPose(rig, 'right', target, options);
    assert.ok(result.error < before.error, `seat ${seat}: reach improves actual contact`);
    assert.ok(result.leanRadians <= THREE.MathUtils.degToRad(65) + 1e-8);
    assert.ok(result.armExtension <= 1.18);
    assert.ok(rig.hips.getWorldPosition(new THREE.Vector3()).distanceTo(hipsBefore) < 1e-5);
    assert.deepEqual(actor.position.toArray(), rootBefore.toArray());
    assert.deepEqual(chair.position.toArray(), chairBefore.toArray());
    applySeatedHumanPose(rig, 'idle');
    assert.deepEqual(rig.rightForeArm.position.toArray(), lowerBefore.toArray());
    assert.deepEqual(rig.rightHand.position.toArray(), handBefore.toArray());
    diagnostics.push({ seat, before: Number(before.error.toFixed(3)), after: Number(result.error.toFixed(3)), leanDegrees: Number(THREE.MathUtils.radToDeg(result.leanRadians).toFixed(1)), armExtension: result.armExtension });
  }
  context.diagnostic(JSON.stringify(diagnostics));
});

test('actual RPM nearest-edge pinch reaches the centre within bounded action-only adjustment across the breathing cycle', (context) => {
  let poseTime = 0;
  context.mock.method(performance, 'now', () => poseTime);
  let worstError = 0;
  for (poseTime of [0, Math.PI / 0.004, Math.PI * 3 / 0.004]) {
    for (let seat = 0; seat < 4; seat += 1) {
      const { rig, actor } = makeActualDominoRig(seat);
      applySeatedHumanPose(rig, 'placePiece');
      const actorBefore = actor.position.clone();
      const hipsBefore = rig.hips.getWorldPosition(new THREE.Vector3());
      const sign = seat < 2 ? 1 : -1;
      const target = seat % 2 === 0
        ? new THREE.Vector3(0, 0.70892, sign * 0.09065)
        : new THREE.Vector3(sign * 0.06232, 0.70892, 0);
      const approach = target.clone().sub(rig.rightUpperArm.getWorldPosition(new THREE.Vector3()));
      approach.y = 0;
      approach.normalize();
      const result = applySeatedHumanReachPose(rig, 'right', target, {
        grip: 0.4,
        approachDirection: approach,
        palmNormal: new THREE.Vector3(0, 1, 0),
        maxLean: THREE.MathUtils.degToRad(88),
        maxArmExtension: 1.35
      });
      assert.ok(result.error < 0.002, `seat ${seat} contact gap ${result.error} stays below the domino edge bevel`);
      assert.ok(result.armExtension <= 1.35);
      assert.ok(result.leanRadians <= THREE.MathUtils.degToRad(88) + 1e-8);
      assert.deepEqual(actor.position.toArray(), actorBefore.toArray());
      assert.ok(rig.hips.getWorldPosition(new THREE.Vector3()).distanceTo(hipsBefore) < 1e-6);
      worstError = Math.max(worstError, result.error);
    }
  }
  context.diagnostic(`Largest centre contact residual over all seats and breathing extremes: ${worstError.toFixed(5)} world units`);
});

function makeProductionHandHarness() {
  const { parse } = createRequire(import.meta.url)('@babel/parser');
  const source = readFileSync(new URL('../../../../public/domino-royal-game.js', import.meta.url), 'utf8');
  const definitions = new Map();
  for (const node of parse(source, { sourceType: 'module' }).program.body) {
    if (node.type === 'FunctionDeclaration') definitions.set(node.id.name, source.slice(node.start, node.end));
    if (node.type === 'VariableDeclaration') for (const declaration of node.declarations) {
      if (declaration.id.name && declaration.init) definitions.set(declaration.id.name, source.slice(declaration.init.start, declaration.init.end));
    }
  }
  const actors = Array.from({ length: 4 }, (_, seat) => makeActualDominoRig(seat));
  const c = vm.createContext({
    THREE, N: 4, human: 0, cameraViewMode: '3d', VIEW_MODES: { twoD: '2d' },
    seatedHumanActors: actors, chairs: actors.map(({ chair }) => chair),
    openingSequence: null, players: Array.from({ length: 4 }, () => ({ hand: [] })),
    piecesG: new THREE.Group(), activeHandMeshes: new Set(), dominoHandContacts: new Map(),
    selectedTile: null, revealAllHands: false, gameFinished: false, winnerIndex: null,
    clearSelectedHighlight() {}, updateLeaderboardCard() {},
    disposeDominoMesh(mesh) { mesh.removeFromParent(); },
    handErrors: {},
    DOMINO_SEATED_HUMANS: {
      applySeatedHumanPose, applySeatedHumanReachPose,
      applySeatedHumanHandTargets(rig, targets) {
        applySeatedHumanHandTargets(rig, targets);
        c.handErrors = {};
        for (const side of ['left', 'right']) if (targets[side]) {
          const actual = new THREE.Vector3();
          rig[`${side}ContactTips`].forEach((tip) => actual.add(tip.getWorldPosition(new THREE.Vector3())));
          actual.multiplyScalar(1 / rig[`${side}ContactTips`].length);
          c.handErrors[side] = actual.distanceTo(targets[side].position);
        }
      }
    },
    makeDomino(a, b, { flat = true } = {}) {
      const mesh = new THREE.Group();
      mesh.scale.set(0.1, flat ? 0.016 / 0.22 : 0.1, flat ? 0.1 : 0.016 / 0.22).multiplyScalar(c.DOMINO_WORLD_SCALE);
      if (flat) mesh.rotation.x = -Math.PI / 2;
      return mesh;
    }
  });
  const load = (name) => {
    if (Object.hasOwn(c, name)) return c[name];
    for (;;) {
      try { return c[name] = vm.runInContext(`(${definitions.get(name)})`, c); }
      catch (error) {
        const dependency = error.message.match(/^(\w+) is not defined$/)?.[1];
        if (!dependency || !definitions.has(dependency)) throw error;
        load(dependency);
      }
    }
  };
  [
    'layoutSeat', 'getVisualSeatIndex', 'computeHandSlotPosition',
    'CLOTH_RADIUS', 'TABLE_LEFT_RIGHT_SHRINK_FACTOR', 'DOMINO_HAND_GAP',
    'PLAYER_HAND_MIN_GAP_SCALE', 'PLAYER_HAND_OPPONENT_MIN_GAP_SCALE',
    'DOMINO_LENGTH', 'PLAYER_HAND_GAP_SCALE', 'PLAYER_HAND_CENTER_VERTICAL_DROP',
    'CLOTH_TOP', 'HAND_Y', 'PLAYER_HAND_VERTICAL_RAISE',
    'PLAYER_HAND_OPPONENT_VERTICAL_EXTRA', 'HUMAN_PLAYER_HAND_OUTWARD_OFFSET',
    'PLAYER_HAND_OUTWARD_OFFSET', 'PLAYER_HAND_OPPONENT_OUTWARD_EXTRA',
    'PLAYER_HAND_TOP_OUTWARD_EXTRA', 'PLAYER_HAND_SIDE_OUTWARD_EXTRA',
    'PLAYER_HAND_SIDE_EDGE_OUTWARD_EXTRA', 'HUMAN_BOTTOM_HAND_GAP_SCALE',
    'HUMAN_HAND_OUTWARD_OFFSET', 'HUMAN_BOTTOM_EXTRA_OUTWARD',
    'HUMAN_HAND_VERTICAL_OFFSET', 'HUMAN_BOTTOM_EXTRA_RAISE',
    'renderHands', 'getHumanHandCountScale', 'getDominoHandScale',
    'HUMAN_PLAYER_HAND_TILE_SCALE', 'PLAYER_HAND_TILE_SCALE', 'DOMINO_WORLD_SCALE',
    'DOMINO_WIDTH', 'CHAIN_TILE_Y', 'getDominoHumanReachProfile',
    'runSeatedHumanDominoAction', 'dominoSurfaceTarget', 'dominoPickupTarget',
    'getDominoRackTargets', 'poseDominoHands', 'updateSeatedHumanDominoAction',
    'smoothPlacementStep', 'resolvePrecisionPlacementPosition',
    'PLACE_ANIM_PICK_HOLD', 'PLACE_ANIM_LIFT_END', 'PLACE_ANIM_CARRY_END',
    'PLACE_ANIM_LOWER_END', 'PLACE_ANIM_ARC',
    'orientDominoFlat', 'orientDominoFaceDown', 'DOMINO_FORWARD', 'DOMINO_RIGHT', 'DOMINO_UP', 'DOMINO_BASIS'
  ].forEach(load);
  return c;
}

test('production draw and placement hand targets stay on the real RPM fingertips through the full tile path', (context) => {
  context.mock.method(performance, 'now', () => 0);
  const c = makeProductionHandHarness();
  const summary = [];
  for (const direction of ['place', 'draw', 'stock']) for (let seat = 0; seat < 4; seat += 1) {
    for (const player of c.players) player.hand = Array.from({ length: 7 }, () => ({ a: 2, b: 5 }));
    c.renderHands();
    c.dominoHandContacts.clear();
    c.poseDominoHands(seat);
    const mesh = c.players[seat].hand[3].mesh;
    c.players[seat].hand[3].mesh = null;
    const rackPosition = mesh.position.clone();
    const rackQuaternion = mesh.quaternion.clone();
    const rackScale = mesh.scale.clone();
    const board = new THREE.Object3D();
    const placing = direction === 'place';
    if (placing) c.orientDominoFlat(board, Math.PI / 2);
    else c.orientDominoFaceDown(board, Math.PI / 2);
    const boardPosition = direction === 'stock'
      ? new THREE.Vector3(0, c.CLOTH_TOP + 0.006, c.CLOTH_RADIUS * 0.45)
      : new THREE.Vector3(0, c.CHAIN_TILE_Y, 0);
    const boardScale = new THREE.Vector3(0.1, 0.016 / 0.22, 0.1).multiplyScalar(c.DOMINO_WORLD_SCALE);
    const anim = {
      mesh, sourceSeat: seat,
      ...(placing ? { segment: {} } : {}),
      start: (placing ? rackPosition : boardPosition).clone(),
      end: (placing ? boardPosition : rackPosition).clone(),
      startQuat: (placing ? rackQuaternion : board.quaternion).clone(),
      endQuat: (placing ? board.quaternion : rackQuaternion).clone(),
      startScale: (placing ? rackScale : boardScale).clone(),
      endScale: (placing ? boardScale : rackScale).clone(),
      arc: c.PLACE_ANIM_ARC
    };
    anim.humanReachProfile = c.getDominoHumanReachProfile(anim);
    let maxRightError = 0;
    let maxLeftError = 0;
    let maxLeftAt = 0;
    let landingError = 0;
    let maxExtension = 1;
    let maxLeftExtension = 1;
    for (let frame = 0; frame <= 120; frame += 1) {
      const t = frame / 120;
      const rotation = c.smoothPlacementStep(c.PLACE_ANIM_LIFT_END, c.PLACE_ANIM_LOWER_END, t);
      mesh.position.copy(c.resolvePrecisionPlacementPosition(anim, t));
      mesh.quaternion.slerpQuaternions(anim.startQuat, anim.endQuat, rotation);
      mesh.scale.lerpVectors(anim.startScale, anim.endScale, rotation);
      c.updateSeatedHumanDominoAction(anim, t);
      const rig = c.seatedHumanActors[seat].rig;
      maxExtension = Math.max(maxExtension, rig.rightForeArm.position.length() / rig.saved.get(rig.rightForeArm).position.length());
      maxLeftExtension = Math.max(maxLeftExtension, rig.leftForeArm.position.length() / rig.saved.get(rig.leftForeArm).position.length());
      if (t >= c.PLACE_ANIM_PICK_HOLD && t <= c.PLACE_ANIM_LOWER_END) {
        maxRightError = Math.max(maxRightError, c.handErrors.right || 0);
        if ((c.handErrors.left || 0) > maxLeftError) { maxLeftError = c.handErrors.left; maxLeftAt = t; }
        landingError = c.handErrors.right || 0;
      }
    }
    const extensionCap = direction === 'stock' && seat === 2 ? 1.65 : 1.35;
    assert.ok(maxExtension <= extensionCap + 1e-8, `${direction}, seat ${seat}: extension is scoped to its actual source`);
    assert.ok(maxLeftExtension <= 1.35000001, 'left rack support never uses the exceptional far-stock cap');
    summary.push({ direction, seat, edge: anim.contactSide, right: +maxRightError.toFixed(4), left: +maxLeftError.toFixed(4), leftAt: +maxLeftAt.toFixed(3), landing: +landingError.toFixed(4), maxExtension: +maxExtension.toFixed(4) });
  }
  context.diagnostic(JSON.stringify(summary));
  assert.ok(summary.every((entry) => entry.right < 0.002), 'production edge selection must keep contact through pickup, rotation and landing');
  assert.ok(summary.every((entry) => entry.left < 0.002), 'left fingers must continue supporting the rack during the right-hand action');
});

test('optional independent arm extension uses an absolute cap and never compounds across solves', () => {
  const { rig } = makeRig();
  const upperLength = rig.leftForeArm.position.length();
  const lowerLength = rig.leftHand.position.length();
  const untouchedRight = rig.rightForeArm.position.clone();
  for (const requestedCap of [1.35, 1.65, 100]) for (let frame = 0; frame < 40; frame += 1) {
    const absoluteCap = Math.min(1.65, requestedCap);
    applySeatedHumanArmIK(rig, 'left', new THREE.Vector3(-10, 0, 10), { grip: 0.4, maxArmExtension: requestedCap });
    assert.ok(rig.leftForeArm.position.length() / upperLength <= absoluteCap + 1e-8);
    assert.ok(rig.leftHand.position.length() / lowerLength <= absoluteCap + 1e-8);
  }
  assert.deepEqual(rig.rightForeArm.position.toArray(), untouchedRight.toArray());
  applySeatedHumanPose(rig, 'idle');
  assert.ok(Math.abs(rig.leftForeArm.position.length() - upperLength) < 1e-10);
  assert.ok(Math.abs(rig.leftHand.position.length() - lowerLength) < 1e-10);
});
