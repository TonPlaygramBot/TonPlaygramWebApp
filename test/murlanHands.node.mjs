import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { RoundedBoxGeometry } from '../webapp/node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createHash } from 'node:crypto';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { GLTFLoader } from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from '../webapp/node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import {
  MurlanHandController,
  MURLAN_KNOCK_IMPACTS_MS,
  MURLAN_PASS_DURATION_MS,
  MURLAN_HOLD_REACH_LIMIT,
  MURLAN_KNOCK_REACH_LIMIT,
  resolveMurlanArm,
  solveMurlanArm,
  murlanFanGrips
} from '../webapp/src/pages/Games/shared/MurlanHandController.ts';

const modelBytes = fs.readFileSync(new URL('../webapp/public/assets/pool-royale/readyplayer.me.glb', import.meta.url));
const loader = new GLTFLoader();
loader.register(() => ({ name: 'MURLAN_TEST_NO_TEXTURES', loadTexture: () => Promise.resolve(null) }));
const template = (await new Promise((resolve, reject) => loader.parse(
  modelBytes.buffer.slice(modelBytes.byteOffset, modelBytes.byteOffset + modelBytes.byteLength), '', resolve, reject
))).scene;
const position = (object) => object.getWorldPosition(new THREE.Vector3());
const finite = (numbers) => numbers.every(Number.isFinite);

function fixture({ yaw = 0, scale = new THREE.Vector3(1, 1, 1) } = {}) {
  const seatRoot = new THREE.Group();
  seatRoot.rotation.y = yaw;
  seatRoot.scale.copy(scale);
  const instance = cloneSkeleton(template);
  seatRoot.add(instance);
  seatRoot.updateMatrixWorld(true);
  const right = new THREE.Vector3(1, 0, 0).transformDirection(seatRoot.matrixWorld);
  const forward = new THREE.Vector3(0, 0, -1).transformDirection(seatRoot.matrixWorld);
  const rig = { instance, seatRoot, seatConfig: { forward, right }, bones: {} };
  return { rig, controller: new MurlanHandController(rig) };
}

function fan(rig, count) {
  const group = new THREE.Group();
  rig.seatRoot.add(group);
  const cards = Array.from({ length: count }, (_, i) => {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.23, 0.006));
    const offset = count < 2 ? 0 : i / (count - 1) - 0.5;
    card.position.set(offset * 0.25, 1.36 + (1 - Math.abs(offset) * 2) * 0.015, 0.28 + i * 0.001);
    card.rotation.set(-0.06, offset * 0.55, 0);
    card.scale.setScalar(0.95);
    group.add(card);
    return card;
  });
  group.updateWorldMatrix(true, true);
  return cards;
}

function localTransforms(cards) {
  return cards.map((card) => ({
    position: card.position.toArray(), quaternion: card.quaternion.toArray(), scale: card.scale.toArray(),
    matrix: card.matrix.toArray(), parent: card.parent?.uuid ?? null
  }));
}

function rigPose(controller) {
  return ['left', 'right'].flatMap((side) => {
    const arm = controller.arms[side];
    return [arm.upper, arm.fore, arm.hand].flatMap((bone) => [
      ...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()
    ]);
  });
}

function assertNearArrays(actual, expected, tolerance = 1e-8) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) <= tolerance,
    `entry ${i}: ${value} vs ${expected[i]}`));
}

test('shipped RPM wrists resolve to direct upper-arm and forearm bones', () => {
  for (const side of ['left', 'right']) {
    const arm = resolveMurlanArm(template, side);
    const name = side[0].toUpperCase() + side.slice(1);
    assert.equal(arm.upper.name, `${name}Arm`);
    assert.equal(arm.fore.name, `${name}ForeArm`);
    assert.equal(arm.hand.name, `${name}Hand`);
    assert.equal(arm.hand.parent, arm.fore);
    assert.equal(arm.fore.parent, arm.upper);
  }
  assert.equal(resolveMurlanArm(new THREE.Group(), 'right'), null);
});

test('world-space IK is finite and reproducible under rotated, scaled chair parents', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const { controller } = fixture({ yaw, scale: new THREE.Vector3(1.28, 1.28 * 1.08, 1.28) });
    for (const side of ['left', 'right']) {
      const arm = controller.arms[side];
      const shoulder = position(arm.upper);
      const target = shoulder.clone().add(new THREE.Vector3(side === 'right' ? -0.12 : 0.12, -0.18, 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      const pole = shoulder.clone().add(new THREE.Vector3(side === 'right' ? -0.4 : 0.4, -0.3, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
      const rest = [arm.upper, arm.fore, arm.hand].map((bone) => bone.quaternion.clone());
      const solve = () => {
        [arm.upper, arm.fore, arm.hand].forEach((bone, i) => bone.quaternion.copy(rest[i]));
        const error = solveMurlanArm(arm, target, pole);
        assert.ok(Number.isFinite(error));
        assert.ok(error < 0.04, `reachable ${side} wrist error ${error} at yaw ${yaw}`);
        const pose = [arm.upper, arm.fore, arm.hand].flatMap((bone) => bone.quaternion.toArray());
        assert.ok(finite(pose));
        return pose;
      };
      assertNearArrays(solve(), solve());
    }
  }
});

test('one, five, and thirteen cards expose both outer holding edges without mutating cards', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    for (const count of [1, 5, 13]) {
      const { rig, controller } = fixture({ yaw });
      const cards = fan(rig, count);
      const before = localTransforms(cards);
      const grips = murlanFanGrips(cards, rig.seatConfig.right);
      assert.ok(grips);
      const left = grips.left.position.dot(rig.seatConfig.right);
      const right = grips.right.position.dot(rig.seatConfig.right);
      assert.ok(right - left >= 0.14, 'both sides remain distinct even for a single card');
      const centers = cards.map((card) => position(card).dot(rig.seatConfig.right));
      assert.ok(left < Math.min(...centers));
      assert.ok(right > Math.max(...centers));
      for (const time of [0, 16, 100, 500]) controller.update(time, cards);
      assert.ok(finite(rigPose(controller)));
      assert.ok(controller.errors.left < 0.04 && controller.errors.right < 0.04,
        `reachable fan contact errors: ${JSON.stringify(controller.errors)}`);
      assert.deepEqual(localTransforms(cards), before);
      cards.forEach((card) => { card.visible = false; });
      assert.equal(murlanFanGrips(cards, rig.seatConfig.right), null);
    }
  }
});

test('holding pose is stable and an empty hand does not accumulate drift', () => {
  const { rig, controller } = fixture();
  const cards = fan(rig, 5);
  controller.update(0, cards);
  const holding = rigPose(controller);
  for (let i = 1; i <= 60; i++) controller.update(i * 16, cards);
  assertNearArrays(rigPose(controller), holding, 1e-6);
  controller.update(1000, []);
  const empty = rigPose(controller);
  for (let i = 1; i <= 120; i++) controller.update(1000 + i * 16, []);
  assertNearArrays(rigPose(controller), empty, 1e-6);
});

test('PASS fires exactly two sounds at impact and does not replay stale sounds after a skipped frame', () => {
  const { rig, controller } = fixture();
  const cards = fan(rig, 5);
  controller.update(0, cards);
  const impacts = [];
  let time = 0;
  assert.equal(controller.start('PASS', 0, undefined, 1.3, () => impacts.push(time)), true);
  for (time of [0, 180, 299, 300, 300, 301, 419, 539, 540, 540, 600, MURLAN_PASS_DURATION_MS, 1000]) {
    controller.update(time, cards);
  }
  assert.deepEqual(impacts, [...MURLAN_KNOCK_IMPACTS_MS]);
  assert.equal(controller.action, null);
  let staleSounds = 0;
  controller.start('PASS', 2000, undefined, 1.3, () => staleSounds++);
  controller.update(2000 + MURLAN_PASS_DURATION_MS + 1000, cards);
  assert.equal(staleSounds, 0);
  assert.equal(controller.action, null);
});

test('cancelled and interrupted gestures never replay old impacts or mutate played cards', () => {
  const { rig, controller } = fixture();
  const cards = fan(rig, 5);
  const before = localTransforms(cards);
  controller.update(0, cards);
  let cancelledSounds = 0;
  controller.start('PASS', 0, undefined, 1.3, () => cancelledSounds++);
  controller.update(100, cards);
  controller.cancel();
  controller.update(540, cards);
  assert.equal(cancelledSounds, 0);
  const played = cards[2];
  played.userData.animation = { duration: 420 };
  controller.start('PASS', 1000, undefined, 1.3, () => cancelledSounds++);
  controller.update(1100, cards);
  controller.start('PLAY', 1200, played, 1.3);
  for (const time of [1200, 1380, 1500, 1620, 1800, 2000]) controller.update(time, cards.filter((card) => card !== played));
  assert.equal(cancelledSounds, 0);
  assert.equal(controller.action, null);
  assert.ok(finite(rigPose(controller)));
  assert.deepEqual(localTransforms(cards), before);
});

test('production hand-card positioning remains identical to the checked-in layout', () => {
  const file = 'webapp/src/pages/Games/MurlanRoyaleArena.jsx';
  const current = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

  const block = (source) => {
    const start = source.indexOf('    state.players.forEach((player, idx) => {', source.indexOf('const applyStateToScene'));
    const end = source.indexOf('    const tableAnchor = three.tableAnchor.clone();', start);
    assert.ok(start >= 0 && end > start, 'production hand layout is identifiable');
    return source.slice(start, end).replace(/\s+/g, ' ').trim();
  };
  // Frozen from main at 69bc6dd before the hand-animation changes.
  const expectedLayoutSha256 = '5e823eac441ef159faf1244e4faf513b5ad38b86e9bddbe4d3eec95f6c5c302f';
  assert.equal(createHash('sha256').update(block(current)).digest('hex'), expectedLayoutSha256);
});


// Execute the arena's own card-positioning code to exercise the production layout,
// while replacing only rendering, materials, and React with small test adapters.
function productionSource() {
  const source = fs.readFileSync(new URL('../webapp/src/pages/Games/MurlanRoyaleArena.jsx', import.meta.url), 'utf8');
  const { parse } = createRequire(new URL('../webapp/package.json', import.meta.url))('@babel/parser');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] });
  const noop = () => {};
  const context = vm.createContext({
    THREE, resolveMurlanArm, console, window: undefined, performance: { now: () => 0 },
    applyHandCardLayering: noop, applyTableCardLayering: noop, setBackLogoOrientation: noop, updateCardFace: noop, setCommunityCardLegibility: noop
  });
  let declarations = ast.program.body.filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations.filter((declaration) => declaration.id.type === 'Identifier' && declaration.init));
  for (let pass = 0; pass < 12 && declarations.length; pass++) {
    declarations = declarations.filter((declaration) => {
      try {
        vm.runInContext(`globalThis.${declaration.id.name}=(${source.slice(declaration.init.start, declaration.init.end)})`, context, { timeout: 100 });
        return false;
      } catch { return true; }
    });
  }
  for (const name of ['normalizeCharacterPivot', 'fitCharacterModelForSeat', 'findBoneByHints', 'captureBoneRotation', 'applyRotationOffset', 'createCharacterRig', 'resolveSeatHandRadius', 'calcFanCardPose', 'orientMesh', 'setMeshPosition', 'easeInOutCubic', 'easeOutCubic']) {
    const node = ast.program.body.find((candidate) => candidate.type === 'FunctionDeclaration' && candidate.id.name === name);
    assert.ok(node, `arena function ${name} exists`);
    vm.runInContext(source.slice(node.start, node.end), context);
  }
  const start = source.indexOf('    state.players.forEach((player, idx) => {', source.indexOf('const applyStateToScene'));
  const end = source.indexOf('    const tableAnchor = three.tableAnchor.clone();', start);
  vm.runInContext(`function positionCards(state, three) {
    const seatConfigs=three.seatConfigs, cardMap=three.cardMap;
    const selectionSet=new Set(), handsVisible=new Set(), previous=null;
    const humanTurn=false, immediate=true, isInitialDealAnimation=false;
    ${source.slice(start, end)}
  }`, context);
  const tableStart = source.indexOf('    const tableAnchor = three.tableAnchor.clone();', start);
  const tableEnd = source.indexOf('    const pileRightAxis =', tableStart);
  vm.runInContext(`function positionPlayedCard(state, three, previous) {
    const seatConfigs=three.seatConfigs, cardMap=three.cardMap, immediate=false;
    ${source.slice(tableStart, tableEnd)}
  }`, context);
  const animationStart = source.indexOf('        const list = store.animations;', source.indexOf('const stepAnimations ='));
  const animationEnd = source.indexOf('        stepCharacterActions(store, time);', animationStart);
  vm.runInContext(`function stepCardAnimation(store, time) { ${source.slice(animationStart, animationEnd)} }`, context);
  return context;
}
const production = productionSource();

function productionFixture(seatIndex, count = 13, radiusFactor = 1, chairWorldY = null) {
  const p = production;
  const isHuman = seatIndex === 0;
  const angle = p.CUSTOM_SEAT_ANGLES[seatIndex];
  const isSide = !isHuman && Math.abs(Math.cos(angle)) > 0.45;
  const seatRadius = p.AI_CHAIR_RADIUS + (isHuman ? p.HUMAN_CHAIR_EXTRA_OUTWARD_OFFSET : 0) - (isSide ? p.SIDE_PLAYER_SEAT_INWARD_OFFSET : 0);
  const chair = new THREE.Group();
  chair.scale.set(p.CHAIR_VISUAL_SCALE, p.CHAIR_VISUAL_SCALE * 1.08, p.CHAIR_VISUAL_SCALE);
  chair.position.set(Math.cos(angle) * seatRadius, chairWorldY ?? (p.ARENA_GROUND_Y - p.CHAIR_SCREEN_LOWER_OFFSET), Math.sin(angle) * seatRadius);
  chair.lookAt(new THREE.Vector3(0, chair.position.y, 0));
  const forward = new THREE.Vector3(chair.position.x, 0, chair.position.z).normalize();
  const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
  const top = forward.z < -0.45;
  const seatConfig = {
    seatIndex, chair, forward, right, focus: new THREE.Vector3(),
    radius: p.resolveSeatHandRadius(p.TABLE_RADIUS * radiusFactor, true),
    spacing: isHuman ? p.HUMAN_HAND_CARD_SPACING : p.AI_HAND_CARD_SPACING * (isSide ? p.SIDE_AI_HAND_CARD_SPACING_MULTIPLIER : top ? p.TOP_AI_HAND_CARD_SPACING_MULTIPLIER : 1),
    maxSpread: isHuman ? p.HUMAN_HAND_CARD_MAX_SPREAD : p.AI_HAND_CARD_MAX_SPREAD * (isSide ? p.SIDE_AI_HAND_CARD_MAX_SPREAD_MULTIPLIER : top ? p.TOP_AI_HAND_CARD_MAX_SPREAD_MULTIPLIER : 1),
    handVariant: isSide ? 'side' : top ? 'top' : 'default'
  };
  const theme = { scale: 1, normalizedSeatOffsetY: -0.4, normalizedSeatOffsetZ: 0.52, seatPitch: 0, seatYaw: 0 };
  const instance = cloneSkeleton(template);
  p.fitCharacterModelForSeat(instance, theme);
  p.normalizeCharacterPivot(instance);
  const seatRoot = new THREE.Group();
  seatRoot.scale.setScalar(theme.scale * p.CHARACTER_PROPORTION_SCALE * 1.06);
  seatRoot.position.set(0, theme.normalizedSeatOffsetY - 0.2 - 0.22 - (p.CHARACTER_PROPORTION_SCALE - 1) * 0.08 - p.HUMAN_CHARACTER_EXTRA_LOWER_OFFSET,
    theme.normalizedSeatOffsetZ - 0.03 - p.HUMAN_CHARACTER_EXTRA_OUTWARD_OFFSET);
  seatRoot.add(instance);
  const hand = Array.from({ length: count }, (_, i) => ({ id: `production-${seatIndex}-${i}`, rank: `${i + 1}`, suit: 'S' }));
  const rig = p.createCharacterRig(instance, seatRoot, seatConfig, theme, { isHuman, hand }, seatIndex, {});
  chair.add(seatRoot);
  chair.updateMatrixWorld(true);
  const radius = Math.max(0.001, Math.min(Math.min(p.CARD_W, p.CARD_H) * 0.31, Math.min(p.CARD_D * 0.45, Math.min(p.CARD_W, p.CARD_H) * 0.12)));
  const geometry = new RoundedBoxGeometry(p.CARD_W, p.CARD_H, p.CARD_D, 14, radius);
  const cards = hand.map(() => new THREE.Mesh(geometry));
  const cardMap = new Map(hand.map((card, i) => [card.id, { mesh: cards[i] }]));
  const seatConfigs = []; seatConfigs[seatIndex] = seatConfig;
  const players = []; players[seatIndex] = { isHuman, hand };
  const state = { players };
  const store = { seatConfigs, cardMap, animations: [], selectionTargets: [], tableAnchor: new THREE.Vector3(0, p.TABLE_HEIGHT + p.CARD_SURFACE_OFFSET, p.TABLE_CARD_AREA_FORWARD_SHIFT) };
  p.positionCards(state, store);
  cards.forEach((card) => card.updateWorldMatrix(true, false));
  return { rig, cards, state, store, controller: new MurlanHandController(rig) };
}

test('production fans and tabletop knocks make measured palm contact at every seat', () => {
  const measurements = [];
  for (const seat of [0, 1, 2, 3]) {
    for (const count of [1, 5, 13]) {
      const { controller, cards } = productionFixture(seat, count);
      const before = localTransforms(cards);
      for (const time of [0, 16, 32, 64]) controller.update(time, cards);
      const hold = { ...controller.errors };
      let sounds = 0;
      controller.start('PASS', 1000, undefined, production.TABLE_HEIGHT, () => sounds++, production.TABLE_RADIUS);
      controller.update(1300, cards);
      const first = controller.errors.right;
      controller.update(1540, cards);
      const second = controller.errors.right;
      measurements.push({ seat, count, hold, knocks: [first, second], sounds,
        extensions: [controller.arms.left.extension, controller.arms.right.extension] });
      assert.deepEqual(localTransforms(cards), before);
    }
  }
  for (const measurement of measurements) {
    assert.ok(measurement.hold.left < 0.005 && measurement.hold.right < 0.005,
      `production holding contact: ${JSON.stringify(measurement)}`);
    assert.ok(measurement.knocks.every((error) => error < 0.005), `production table contact: ${JSON.stringify(measurement)}`);
    assert.equal(measurement.sounds, 2, `production audible knocks: ${JSON.stringify(measurement)}`);
  }
});


test('real 1680 ms card trajectory releases at arm reach and recovers, including the final card', () => {
  for (const seat of [0, 1, 2, 3]) {
    for (const count of [1, 13]) {
      const { rig, cards, state, store, controller } = productionFixture(seat, count);
      for (const time of [0, 16, 32, 64]) controller.update(time, cards);
      const home = controller.arms.right.grip.position.clone();
      const originalExtension = controller.arms.right.extension;
      const selected = state.players[seat].hand[0];
      const playedMesh = cards[0];
      const remainingMeshes = cards.slice(1);
      const previous = { players: state.players.map((player) => player && { ...player, hand: [...player.hand] }) };
      state.players[seat].hand = state.players[seat].hand.slice(1);
      if (seat !== 0) {
        state.players[0] = { isHuman: true, hand: [] };
        store.seatConfigs[0] = {
          seatIndex: 0, forward: new THREE.Vector3(0, 0, 1), right: new THREE.Vector3(-1, 0, 0),
          spacing: production.HUMAN_HAND_CARD_SPACING, maxSpread: production.HUMAN_HAND_CARD_MAX_SPREAD,
          focus: new THREE.Vector3(0, production.TABLE_HEIGHT, 2)
        };
      }
      state.tableCards = [selected];
      state.lastAction = { type: 'PLAY', playerIndex: seat, cards: [selected] };
      production.positionPlayedCard(state, store, previous);
      assert.equal(playedMesh.userData.animation.duration, 1680, 'production pickup/placement motion is enabled');
      const tableDestination = playedMesh.userData.animation.to.clone();
      controller.start('PLAY', 0, playedMesh, production.TABLE_HEIGHT);
      let released = false;
      let releaseTime = null;
      for (let time = 0; time <= 2200; time += 20) {
        production.stepCardAnimation(store, time);
        cards.forEach((card) => card.updateWorldMatrix(true, false));
        const beforeController = localTransforms(cards);
        const actionWasActive = Boolean(controller.action);
        controller.update(time, remainingMeshes);
        assert.deepEqual(localTransforms(cards), beforeController, 'only the existing card animator can move cards');
        assert.ok(controller.arms.right.extension <= MURLAN_HOLD_REACH_LIMIT, 'placing stays within the established holding reach limit');
        if (actionWasActive) assert.ok(controller.arms.right.extension <= originalExtension + 0.000001, `PLAY uses the existing calibrated arm length: seat=${seat}, count=${count}, time=${time}, original=${originalExtension}, current=${controller.arms.right.extension}`);
        if (controller.action?.released) {
          released = true;
          releaseTime ??= time;
        }
      }
      assert.ok(released, `seat ${seat}, ${count} cards must release when the existing trajectory exceeds reach`);
      assert.ok(releaseTime < 1680, 'release precedes the card arriving at the distant center');
      assert.equal(controller.action, null);
      assert.ok(playedMesh.position.distanceTo(tableDestination) < 1e-8, 'card still reaches its original table destination');
      const target = remainingMeshes.length
        ? murlanFanGrips(remainingMeshes, controller.actorRight ?? rig.seatConfig.right).right.position
        : home;
      const palm = controller.arms.right.hand.localToWorld(controller.arms.right.palm.clone());
      assert.ok(palm.distanceTo(target) < 0.08,
        `seat ${seat}, ${count} cards recovers to hand/home; gap=${palm.distanceTo(target)}`);
    }
  }
});


// Browser evidence: murlan-qa/scene-390.json, portrait 390px, procedural chair fallback.
// The chair's imported pivot raises its world origin; cards keep their existing height.
const RECORDED_PROCEDURAL_CHAIR_WORLD_Y = 1.6352210188087501;

test('recorded elevated procedural chairs retain contact and two delayed-frame knock sounds', () => {
  for (const seat of [0, 1, 2, 3]) {
    for (const count of [1, 5, 13]) {
      const { rig, controller, cards } = productionFixture(seat, count, 1, RECORDED_PROCEDURAL_CHAIR_WORLD_Y);
      const cardTransforms = localTransforms(cards);
      const bodyTransforms = localTransforms([rig.seatRoot, rig.instance, rig.seatConfig.chair]);
      for (const time of [0, 16, 32, 64]) controller.update(time, cards);
      assert.ok(controller.errors.left < 0.005 && controller.errors.right < 0.005,
        `elevated chair holding: seat=${seat}, count=${count}, errors=${JSON.stringify(controller.errors)}`);
      for (const side of ['left', 'right']) {
        assert.ok(controller.arms[side].extension <= MURLAN_HOLD_REACH_LIMIT);
      }
      let sounds = 0;
      controller.start('PASS', 1000, undefined, production.TABLE_HEIGHT, () => sounds++, production.TABLE_RADIUS);
      // Emulate a render arriving 33ms after each impact, as on the phone preview.
      for (const time of [1333, 1573]) {
        controller.update(time, cards);
        assert.ok(controller.errors.right < 0.005,
          `elevated chair knock: seat=${seat}, count=${count}, time=${time}, error=${controller.errors.right}`);
      }
      assert.equal(sounds, 2, `elevated chair audible knocks: seat=${seat}, count=${count}`);
      assert.ok(controller.arms.right.extension <= MURLAN_KNOCK_REACH_LIMIT);
      assert.deepEqual(localTransforms(cards), cardTransforms);
      assert.deepEqual(localTransforms([rig.seatRoot, rig.instance, rig.seatConfig.chair]), bodyTransforms);
    }
  }
});
