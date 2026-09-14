import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';

const { parse } = createRequire(new URL('../webapp/package.json', import.meta.url))('@babel/parser');
const source = await readFile(new URL('../webapp/public/domino-royal-game.js', import.meta.url), 'utf8');
const definitions = new Map();
for (const node of parse(source, { sourceType: 'module' }).program.body) {
  if (node.type === 'FunctionDeclaration') {
    definitions.set(node.id.name, source.slice(node.start, node.end));
  }
  if (node.type === 'VariableDeclaration') {
    for (const declaration of node.declarations) {
      if (declaration.id.name && declaration.init) {
        definitions.set(declaration.id.name, source.slice(declaration.init.start, declaration.init.end));
      }
    }
  }
}

// Execute the real runtime functions with their real numeric constants, without
// booting WebGL, fetching assets, or replacing the behavior under test.
function harness(initial = {}) {
  const context = vm.createContext({ THREE, ...initial });
  function load(name) {
    if (Object.hasOwn(context, name)) return context[name];
    assert.ok(definitions.has(name), `Missing runtime definition: ${name}`);
    for (;;) {
      try {
        return context[name] = vm.runInContext(`(${definitions.get(name)})`, context);
      } catch (error) {
        const dependency = error.message.match(/^(\w+) is not defined$/)?.[1];
        if (!dependency || !definitions.has(dependency)) throw error;
        load(dependency);
      }
    }
  }
  const install = (...names) => names.forEach(load);
  return { context, load, install };
}

function assertPosition(actual, expected, message) {
  const distance = actual.distanceTo(new THREE.Vector3(...expected));
  assert.ok(distance < 1e-10, `${message}: ${actual.toArray()} (error ${distance})`);
}

function handHarness(initial = {}) {
  const result = harness({ N: 4, human: 0, cameraViewMode: '3d', VIEW_MODES: { twoD: '2d' }, ...initial });
  result.install(
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
    'HUMAN_HAND_VERTICAL_OFFSET', 'HUMAN_BOTTOM_EXTRA_RAISE'
  );
  return result;
}

// Measured from main 69bc6dd: adjusting the actors must preserve these rack
// anchors, even when an online player's logical seat differs from visual south.
const existingSevenTileSlots = [
  [[-0.29828855489126405, 1.8214697004300002, 2.5755567667200006], [0, 1.8214697004300002, 2.5755567667200006], [0.29828855489126405, 1.8214697004300002, 2.5755567667200006]],
  [[1.5918142048200001, 1.1558607119100004, -0.3568044914967273], [1.5918142048200001, 1.1558607119100004, 0], [1.5918142048200001, 1.1558607119100004, 0.3568044914967273]],
  [[-0.3568044914967273, 1.1558607119100004, -1.8301744162800002], [0, 1.1558607119100004, -1.8301744162800002], [0.3568044914967273, 1.1558607119100004, -1.8301744162800002]],
  [[-1.5918142048200001, 1.1558607119100004, -0.3568044914967273], [-1.5918142048200001, 1.1558607119100004, 0], [-1.5918142048200001, 1.1558607119100004, 0.3568044914967273]]
];
const existingFlatHumanSlots = [
  [-0.33896426692189097, 0.72492025, 1.78031606508],
  [0, 0.72492025, 1.78031606508],
  [0.33896426692189097, 0.72492025, 1.78031606508]
];

test('existing seven-tile rack anchors survive all local and online seat rotations', () => {
  const { context: c } = handHarness();
  for (const count of [2, 3, 4]) for (let local = 0; local < count; local++) {
    c.N = count;
    c.human = local;
    for (let seat = 0; seat < count; seat++) for (const isTopDown of [false, true]) {
      const relativeSeat = (seat - local + count) % count;
      const visualSeat = count === 2 && relativeSeat === 1 ? 2 : relativeSeat;
      const expected = isTopDown && seat === local
        ? existingFlatHumanSlots
        : existingSevenTileSlots[visualSeat];
      for (const [index, slot] of [0, 3, 6].entries()) {
        assertPosition(c.computeHandSlotPosition(seat, slot, 7, { isTopDown }), expected[index],
          `${count} players, local ${local}, seat ${seat}, slot ${slot}, flat ${isTopDown}`);
      }
    }
  }
});

test('human hand size stays unchanged through seven and decreases progressively thereafter', () => {
  const { load } = harness();
  const scale = load('getHumanHandCountScale');
  for (let count = 0; count <= 7; count++) assert.equal(scale(count), 1);
  let previous = scale(7);
  for (let count = 8; count <= 28; count++) {
    const next = scale(count);
    assert.ok(Number.isFinite(next) && next > 0 && next < previous, `${count} tiles: ${next}`);
    assert.ok(previous - next <= 0.125, 'one draw causes an abrupt size jump');
    assert.ok(next * count <= 7 + 1e-10, 'total tile widths exceed the original seven-tile budget');
    previous = next;
  }
  assert.equal(scale(7), 1, 'size must recover when the hand shrinks back to seven');
});

test('flat orientation preserves position and scale, with no tilt at arbitrary table headings', () => {
  const { context: c, install } = harness();
  install('orientDominoFlat', 'DOMINO_FORWARD', 'DOMINO_RIGHT', 'DOMINO_UP', 'DOMINO_BASIS');
  for (const yaw of [0, 0.23, Math.PI / 2, Math.PI, -Math.PI / 2, 5.7, NaN]) {
    const tile = new THREE.Object3D();
    tile.position.set(0.27, 0.73, -0.61);
    tile.scale.set(0.12, 0.085, 0.09);
    c.orientDominoFlat(tile, yaw);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(tile.quaternion);
    assertPosition(normal, [0, 1, 0], `flat face at yaw ${yaw}`);
    assertPosition(tile.position, [0.27, 0.73, -0.61], 'orientation moved the tile');
    assertPosition(tile.scale, [0.12, 0.085, 0.09], 'orientation resized the tile');
  }
});

function motionHarness(initial = {}) {
  const result = harness(initial);
  result.install('smoothPlacementStep', 'resolvePrecisionPlacementPosition',
    'PLACE_ANIM_PICK_HOLD', 'PLACE_ANIM_LIFT_END', 'PLACE_ANIM_CARRY_END',
    'PLACE_ANIM_LOWER_END', 'PLACE_ANIM_ARC');
  return result;
}

test('pickup holds the source until grip, lifts before carrying, and lands exactly on the destination', () => {
  const { context: c } = motionHarness();
  for (const [start, end] of [
    [[-0.3, 1.8, 2.5], [0.4, 0.73, -0.2]],
    [[0.1, 0.73, 0.4], [-0.25, 1.8, 2.5]],
    [[1.59, 1.15, -0.3], [-0.5, 0.73, 0.3]]
  ]) {
    const anim = { start: new THREE.Vector3(...start), end: new THREE.Vector3(...end), arc: 0.075 };
    for (const t of [0, c.PLACE_ANIM_PICK_HOLD / 2, c.PLACE_ANIM_PICK_HOLD]) {
      assertPosition(c.resolvePrecisionPlacementPosition(anim, t), start, `tile moved before grip at ${t}`);
    }
    const lift = c.resolvePrecisionPlacementPosition(anim, c.PLACE_ANIM_LIFT_END);
    assert.equal(lift.x, start[0]);
    assert.equal(lift.z, start[2]);
    assert.ok(lift.y > start[1], 'horizontal carrying began without lifting');
    for (let frame = 0; frame <= 240; frame++) {
      const position = c.resolvePrecisionPlacementPosition(anim, frame / 240);
      assert.ok(position.toArray().every(Number.isFinite));
      assert.ok(position.y >= Math.min(start[1], end[1]) - 1e-10, 'tile passed through its supporting surface');
    }
    for (const boundary of [c.PLACE_ANIM_PICK_HOLD, c.PLACE_ANIM_LIFT_END, c.PLACE_ANIM_CARRY_END, c.PLACE_ANIM_LOWER_END]) {
      const before = c.resolvePrecisionPlacementPosition(anim, boundary - 1e-7);
      const after = c.resolvePrecisionPlacementPosition(anim, boundary + 1e-7);
      assert.ok(before.distanceTo(after) < 1e-5, `position jumps at phase boundary ${boundary}`);
    }
    assertPosition(c.resolvePrecisionPlacementPosition(anim, 1), end, 'incorrect final placement');
    assertPosition(anim.start, start, 'motion mutated the stored source');
    assertPosition(anim.end, end, 'motion mutated the stored destination');
  }
});

function gameHarness(playerCount = 4, seed = 412) {
  const randomMath = Object.create(Math);
  randomMath.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const events = [];
  const result = handHarness({ Math: randomMath, N: playerCount });
  const c = result.context;
  Object.assign(c, {
    piecesG: new THREE.Group(), boneyardStackG: new THREE.Group(),
    players: Array.from({ length: playerCount }, () => ({ hand: [] })),
    chairs: [], seatedHumanActors: Array.from({ length: 4 }, () => ({ rig: {} })),
    entrySequenceActive: false, openingSequence: null, dominoMotionTime: 0,
    pendingRemoteDominoState: null, pendingAppearanceChange: null,
    drawAnimations: [], placementAnimations: [], knockAnimations: [],
    activeHandMeshes: new Set(), dominoHandContacts: new Map(), chain: [], selectedTile: null,
    revealAllHands: false, gameFinished: false, winnerIndex: -1,
    boneyardStackVisible: 0, boneyardStackTopLocal: 0,
    current: 0, performance: { now: () => c.dominoMotionTime },
    makeDomino(a, b, options = {}) {
      const mesh = new THREE.Group();
      // Geometry/material creation is outside this state-machine test.
      mesh.spec = { a, b, ...options };
      mesh.scale.set(0.12, 0.09, 0.12);
      return mesh;
    },
    disposeDominoMesh(mesh) { mesh?.removeFromParent(); },
    clearSelectedHighlight() {}, updateLeaderboardCard() {},
    refreshDominoControls() {}, setStatus() {},
    poseDominoShuffleHands() {}, updateSeatedHumanDominoAction() {},
    finishOpeningTurn() { events.push('opening-finished'); },
    SFX: {
      drawTile() { events.push('draw-sound'); },
      place() { events.push('place-sound'); },
      pass() { events.push('pass-sound'); }
    },
    showPassBubble(seat) { events.push(['pass-bubble', seat]); },
    poseDominoHands(seat, targets) { events.push(['pose', seat, targets]); },
    nextTurn(action) { events.push('next-turn', ['next-turn-action', action]); },
    emitDominoOnlineState(action) { events.push(['online', action]); },
    renderChain() { events.push('chain-render'); }
  });
  result.install(
    'getHumanHandCountScale', 'getDominoHandScale', 'HUMAN_PLAYER_HAND_TILE_SCALE',
    'PLAYER_HAND_TILE_SCALE', 'DOMINO_WORLD_SCALE', 'DOMINO_WIDTH',
    'genSet', 'shuffle', 'isValidTile', 'canonTile', 'tileKey',
    'renderHands', 'renderBoneyardStack', 'getBoneyardTopWorld',
    'BONEYARD_STACK_STEP', 'MAX_BONEYARD_DISPLAY', 'drawTileFromStock',
    'orientDominoFlat', 'orientDominoFaceDown', 'DOMINO_FORWARD',
    'DOMINO_RIGHT', 'DOMINO_UP', 'DOMINO_BASIS',
    'getDominoHumanReachProfile', 'getDominoRackTargets', 'dominoSurfaceTarget',
    'spawnDrawAnimation', 'updateDrawDestination',
    'updateDrawAnimations', 'updatePlacementAnimations', 'revealPlacementFace',
    'smoothPlacementStep', 'resolvePrecisionPlacementPosition',
    'PLACE_ANIM_PICK_HOLD', 'PLACE_ANIM_LIFT_END', 'PLACE_ANIM_CARRY_END',
    'PLACE_ANIM_LOWER_END', 'PLACE_ANIM_ARC', 'PLACE_ANIM_DURATION',
    'DRAW_ANIM_DURATION', 'OPENING_DEAL_ANIM_DURATION', 'OPENING_SHUFFLE_ANIM_DURATION',
    'spawnOpeningShuffleAnimation', 'dealOpeningHands', 'updateOpeningSequence', 'updateDominoShuffleTiles',
    'clearExistingDominoMeshes', 'isDominoMotionBusy', 'flushPendingDominoState',
    'schedulePassTurnAdvance', 'updateKnockAnimations', 'KNOCK_DURATION', 'KNOCK_CONTACT_PHASE'
  );
  c.boneyard = c.shuffle(c.genSet());
  c.piecesG.add(c.boneyardStackG);
  c.boneyardStackG.position.set(-0.7, 0.75, 0.2);
  return { ...result, events };
}

test('rack grip targets bracket the existing tile surfaces under translated, scaled and rotated parents', () => {
  const { context: c } = gameHarness();
  for (const player of c.players) player.hand = [{ a: 0, b: 1 }, { a: 2, b: 3 }, { a: 4, b: 5 }];
  c.renderHands();
  c.piecesG.position.set(2.3, -0.7, 4.2);
  c.piecesG.rotation.set(0.12, 0.74, -0.08);
  c.piecesG.scale.set(1.7, 1.2, 0.83);
  c.piecesG.updateMatrixWorld(true);
  for (let seat = 0; seat < 4; seat++) {
    const hand = c.players[seat].hand;
    const first = hand[0].mesh;
    const last = hand.at(-1).mesh;
    const before = hand.map(({ mesh }) => mesh.matrixWorld.clone());
    const outerFirst = first.localToWorld(new THREE.Vector3(-0.5, 0, 0));
    const outerLast = last.localToWorld(new THREE.Vector3(0.5, 0, 0));
    const leftShoulder = new THREE.Object3D();
    const rightShoulder = new THREE.Object3D();
    // Reverse shoulder placement at alternating seats to exercise both valid
    // pairings rather than assuming one world-axis ordering for every player.
    leftShoulder.position.copy(seat % 2 ? outerLast : outerFirst).add(new THREE.Vector3(0, 0.5, 0));
    rightShoulder.position.copy(seat % 2 ? outerFirst : outerLast).add(new THREE.Vector3(0, 0.5, 0));
    c.seatedHumanActors[seat].rig = { leftUpperArm: leftShoulder, rightUpperArm: rightShoulder };
    const targets = c.getDominoRackTargets(seat);
    assert.ok(targets.left && targets.right, 'one end of the rack has no supporting hand');
    const firstTarget = seat % 2 ? targets.right : targets.left;
    const lastTarget = seat % 2 ? targets.left : targets.right;
    const firstLocal = first.worldToLocal(firstTarget.position.clone());
    const lastLocal = last.worldToLocal(lastTarget.position.clone());
    assert.ok(Math.abs(firstLocal.x + 0.5) < 1e-10 && Math.abs(firstLocal.z) < 1e-10,
      'hand does not meet the first tile’s outer side');
    assert.ok(Math.abs(lastLocal.x - 0.5) < 1e-10 && Math.abs(lastLocal.z) < 1e-10,
      'hand does not meet the last tile’s outer side');
    assert.ok(Math.abs(firstLocal.y) <= 1 && Math.abs(lastLocal.y) <= 1,
      'contact lies beyond a domino’s physical length');
    for (const [index, tile] of hand.entries()) {
      tile.mesh.updateMatrixWorld(true);
      assert.deepEqual(tile.mesh.matrixWorld.elements, before[index].elements,
        'arm-target computation moved an existing domino');
    }
  }
});

test('opening keeps all 28 pieces face-down on the cloth until the shuffle finishes', () => {
  const { context: c } = gameHarness();
  c.spawnOpeningShuffleAnimation();
  c.dealOpeningHands();
  c.renderHands();
  assert.equal(c.openingSequence.tiles.length, 28);
  assert.equal(c.activeHandMeshes.size, 0, 'hands appeared before their physical draws');
  assert.equal(c.drawAnimations.length, 0);
  assert.equal(c.isDominoMotionBusy(), true);
  c.updateOpeningSequence(0);
  assert.equal(c.openingSequence.phase, 'shuffle');
  const sequence = c.openingSequence;
  let moved = false;
  for (const fraction of [0, 0.17, 0.39, 0.72, 0.99]) {
    c.updateOpeningSequence(c.OPENING_SHUFFLE_ANIM_DURATION * fraction);
    assert.equal(c.drawAnimations.length, 0, 'dealing started during the wash');
    for (const entry of sequence.tiles) {
      assert.equal(entry.mesh.spec.faceUp, false);
      assert.equal(entry.mesh.spec.flat, true);
      assert.equal(entry.mesh.position.y, entry.home.y, 'shuffle lifts a tile off the cloth');
      assertPosition(new THREE.Vector3(0, 0, 1).applyQuaternion(entry.mesh.quaternion), [0, -1, 0], 'revealed or tilted opening face');
      moved ||= entry.mesh.position.distanceTo(entry.home) > 0.001;
    }
  }
  assert.equal(moved, true, 'opening shuffle has no visible sliding motion');
  c.updateOpeningSequence(c.OPENING_SHUFFLE_ANIM_DURATION);
  assert.equal(sequence.phase, 'deal');
});

test('random opening draws preserve every tile once and finish with seven per occupied seat', () => {
  const signatures = new Set();
  for (const playerCount of [2, 3, 4]) for (const seed of [11, 902]) {
    const { context: c, events } = gameHarness(playerCount, seed);
    c.spawnOpeningShuffleAnimation();
    c.dealOpeningHands();
    const queue = c.openingSequence.dealQueue;
    signatures.add(queue.map(({ tile }) => c.tileKey(tile)).join(','));
    assert.equal(queue.length, playerCount * 7);
    for (let index = 0; index < queue.length; index++) {
      assert.equal(queue[index].seat, index % playerCount, 'opening deals were not round-robin');
      assert.equal(queue[index].source.tile, queue[index].tile, 'a draw targets the wrong physical tile');
    }
    let steps = 0;
    for (let now = 0; now <= 30_000 && c.openingSequence; now += 34) {
      c.dominoMotionTime = now;
      c.updateOpeningSequence(now);
      c.updateDrawAnimations(now);
      assert.ok(c.drawAnimations.length <= 1, 'multiple players pick simultaneously');
      if (c.openingSequence && c.openingSequence.phase !== 'gather') {
        assert.equal(c.piecesG.children.filter((mesh) => mesh.spec).length, 28,
          `a tile duplicated or vanished at step ${steps}`);
      }
      for (const anim of c.drawAnimations) {
        assert.ok(anim.tile.mesh == null, 'moving tile also appears in a rack');
        assert.equal(anim.tile.inTransit, true);
      }
      steps++;
    }
    assert.equal(c.openingSequence, null, 'opening sequence never completed');
    assert.equal(events.filter((event) => event === 'opening-finished').length, 1);
    assert.equal(events.filter((event) => event === 'draw-sound').length, playerCount * 7);
    assert.equal(c.activeHandMeshes.size, playerCount * 7);
    assert.equal(c.boneyard.length, 28 - playerCount * 7);
    const allTiles = [...c.boneyard, ...c.players.flatMap((player) => player.hand)];
    assert.equal(allTiles.length, 28);
    assert.equal(new Set(allTiles.map(c.tileKey)).size, 28);
    for (const player of c.players) {
      assert.equal(player.hand.length, 7);
      for (const tile of player.hand) {
        assert.equal(tile.inTransit, false);
        assert.equal(tile.openingPending, false);
        assert.ok(tile.mesh?.parent === c.piecesG);
      }
    }
  }
  assert.equal(signatures.size, 6, 'different random seeds produced the same opening deal');
});

test('pass waits for the occupied hand, knocks with the right hand, and advances once at multiple frame rates', () => {
  for (const hz of [30, 60, 120]) {
    const { context: c, events } = gameHarness();
    c.schedulePassTurnAdvance(2);
    c.schedulePassTurnAdvance(2);
    assert.equal(c.knockAnimations.length, 1, 'duplicate taps scheduled two passes');
    c.drawAnimations.push({});
    c.updateKnockAnimations(1000);
    assert.equal(c.knockAnimations[0].startTime, null, 'knock raced the unfinished draw');
    assert.equal(events.length, 0);
    c.drawAnimations.length = 0;
    c.updateKnockAnimations(1000);
    const contactTime = 1000 + c.KNOCK_DURATION * c.KNOCK_CONTACT_PHASE;
    c.updateKnockAnimations(contactTime - 0.001);
    assert.equal(events.includes('pass-sound'), false, 'sound played before the hand landed');
    c.updateKnockAnimations(contactTime);
    assert.equal(events.filter((event) => event === 'pass-sound').length, 1);
    const pose = events.filter((event) => Array.isArray(event) && event[0] === 'pose').at(-1);
    assert.equal(pose[1], 2);
    assert.ok(pose[2].right && !pose[2].left, 'the pass must use only the character’s right hand');
    assert.ok(Math.abs(pose[2].right.position.y - (c.CLOTH_TOP + 0.008)) < 1e-10,
      'knock sound and tabletop contact are out of sync');
    for (let now = contactTime; now < 2500; now += 1000 / hz) c.updateKnockAnimations(now);
    assert.equal(events.filter((event) => event === 'pass-sound').length, 1);
    assert.equal(events.filter((event) => event === 'next-turn').length, 1);
    assert.equal(c.knockAnimations.length, 0);
  }
});

test('restart cancels in-flight draw, opening and pass callbacks without later sounds or turn changes', () => {
  const { context: c, events } = gameHarness(3);
  c.spawnOpeningShuffleAnimation();
  c.dealOpeningHands();
  c.updateOpeningSequence(0);
  c.updateOpeningSequence(c.OPENING_SHUFFLE_ANIM_DURATION);
  c.updateOpeningSequence(c.OPENING_SHUFFLE_ANIM_DURATION + 1);
  c.updateDrawAnimations(c.OPENING_SHUFFLE_ANIM_DURATION + 1);
  assert.equal(c.drawAnimations.length, 1);
  c.schedulePassTurnAdvance(0);
  c.drawAnimations[0].onComplete = () => assert.fail('canceled draw callback fired');
  c.clearExistingDominoMeshes();
  const eventsBefore = events.length;
  c.updateOpeningSequence(100_000);
  c.updateDrawAnimations(100_000);
  c.updatePlacementAnimations(100_000);
  c.updateKnockAnimations(100_000);
  assert.equal(events.length, eventsBefore);
  assert.equal(c.openingSequence, null);
  assert.equal(c.isDominoMotionBusy(), false);
  assert.equal(c.piecesG.children.filter((mesh) => mesh.spec).length, 0);
});

test('placement finishes once with the requested position, orientation and scale after skipped frames', () => {
  for (const timestamps of [[0, 30, 300, 750, 1460, 2000], [0, 2000, 2000]]) {
    const { context: c, events } = gameHarness();
    const mesh = new THREE.Group();
    const segment = { animating: true };
    const target = new THREE.Object3D();
    c.orientDominoFlat(target, 0.72);
    const anim = {
      mesh, segment, startTime: 0, duration: 1450, arc: c.PLACE_ANIM_ARC,
      start: new THREE.Vector3(0, 1.8, 2.5), end: new THREE.Vector3(0.3, 0.73, -0.2),
      startQuat: new THREE.Quaternion(), endQuat: target.quaternion.clone(),
      startScale: new THREE.Vector3(0.07, 0.09, 0.08), endScale: new THREE.Vector3(0.1, 0.1, 0.1),
      onComplete() { events.push('placement-finished'); }
    };
    c.placementAnimations.push(anim);
    for (const now of timestamps) c.updatePlacementAnimations(now);
    assert.equal(segment.animating, false);
    assert.equal(c.placementAnimations.length, 0);
    assertPosition(mesh.position, anim.end.toArray(), 'placement missed its destination');
    assertPosition(mesh.scale, anim.endScale.toArray(), 'placement retained its smaller rack size');
    assert.ok(mesh.quaternion.angleTo(anim.endQuat) < 1e-7);
    assert.equal(events.filter((event) => event === 'placement-finished').length, 1);
    assert.equal(events.filter((event) => event === 'place-sound').length, 1);
    assert.equal(events.filter((event) => event === 'chain-render').length, 1);
  }
});

function onlineHarness(playerCount = 4, seed = 412) {
  const result = gameHarness(playerCount, seed);
  const c = result.context;
  Object.assign(c, {
    DOMINO_ONLINE_MODE: true, DOMINO_ONLINE_MATCH: null,
    dominoApplyingRemoteState: false, dominoOnlineHasState: true,
    dominoOnlineStateSeq: 10, dominoOnlineWaitingTimer: null,
    usedTileKeys: new Set(), ends: null,
    racePenaltyTotals: [], raceDisqualifiedPlayers: [], raceRoundNumber: 1,
    lastHandWinnerIndex: null,
    clearMarkers() {}, persistDominoOnlineMatch() {}, setControlEnabled() {},
    refreshSeatAvatars() {}, updateInteractivity() {}, showWinnerOverlay() {},
    checkForBlockedGame() { return false; },
    concludeHand() { result.events.push('hand-finished'); },
    scheduleCpuPlay() { result.events.push('cpu-scheduled'); }
  });
  result.install('stripRuntimeTile', 'hydrateRuntimeTile', 'serializeDominoSegment',
    'buildDominoOnlineState', 'applyDominoOnlineState', 'replayRemoteOpening',
    'takeTileMeshForAnimation', 'attachMeshPreserveWorld', 'spawnPlacementAnimation',
    'TMP_WORLD_POS', 'TMP_WORLD_QUAT', 'TMP_WORLD_SCALE', 'CHAIN_TILE_Y');
  return result;
}

function settledOpeningState(c, firstSeat = 1) {
  const stock = c.shuffle(c.genSet());
  const hands = Array.from({ length: c.N }, () => []);
  for (let round = 0; round < 7; round++) for (const hand of hands) hand.push(stock.pop());
  const starter = hands[firstSeat][3];
  return {
    seq: 10, humanCount: c.N, current: (firstSeat - 1 + c.N) % c.N,
    players: hands.map((hand, seat) => ({ id: seat, hand: hand.filter((tile) => tile !== starter) })),
    boneyard: stock,
    chain: [{ tile: starter, x: 0, z: 0, rot: 0, double: starter.a === starter.b }],
    gameFinished: false, winnerIndex: null, revealAllHands: false,
    openingPresentation: { firstSeat, hands }
  };
}

test('nextTurn publishes the completed action once, with the new owner already selected', () => {
  const { context: c, install, events } = onlineHarness(4);
  delete c.nextTurn;
  install('nextTurn');
  c.players.forEach((player) => { player.hand = [{ a: 1, b: 2 }]; });
  c.emitDominoOnlineState = (action) => events.push({ action, current: c.current });
  c.nextTurn('pass');
  assert.equal(c.current, 3);
  assert.deepEqual(events, [{ action: 'pass', current: 3 }]);
  c.nextTurn();
  assert.deepEqual(events.at(-1), { action: 'turn', current: 2 });
  assert.equal(events.length, 2);
  c.gameFinished = true;
  c.nextTurn('pass');
  assert.equal(events.length, 2, 'finished game published another action');
});

test('online revisions buffer the newest state while moving, then apply once without replaying duplicates', () => {
  const { context: c, events } = onlineHarness(3);
  const initial = settledOpeningState(c);
  Object.assign(c, { players: initial.players, boneyard: initial.boneyard, chain: initial.chain, current: initial.current });
  const originalPlayers = c.players;
  const originalCurrent = c.current;
  c.drawAnimations.push({});
  const newest = { ...initial, openingPresentation: null, seq: 13, current: 2 };
  const newestAction = { type: 'sync', seat: 1 };
  c.applyDominoOnlineState({ ...initial, seq: 11 }, { type: 'sync' });
  c.applyDominoOnlineState(newest, newestAction);
  c.applyDominoOnlineState({ ...initial, seq: 12 }, { type: 'pass' });
  c.applyDominoOnlineState({ ...initial, seq: 13 }, { type: 'pass' });
  c.applyDominoOnlineState({ ...initial, seq: 10 }, { type: 'pass' });
  assert.equal(c.pendingRemoteDominoState.state, newest);
  assert.equal(c.pendingRemoteDominoState.action, newestAction, 'duplicate revision replaced its original action');
  c.flushPendingDominoState();
  assert.equal(c.players, originalPlayers, 'snapshot interrupted the moving hand');
  assert.equal(c.current, originalCurrent);
  assert.equal(c.dominoOnlineStateSeq, 10);
  c.drawAnimations.length = 0;
  c.flushPendingDominoState();
  assert.equal(c.pendingRemoteDominoState, null);
  assert.equal(c.current, 2);
  assert.equal(c.dominoOnlineStateSeq, 13);
  const settledPlayers = c.players;
  const eventCount = events.length;
  c.applyDominoOnlineState(newest, { type: 'pass', seat: 1 });
  c.flushPendingDominoState();
  assert.equal(c.players, settledPlayers, 'an already-applied revision rebuilt the scene');
  assert.equal(c.knockAnimations.length, 0, 'duplicate pass revision replayed the knock');
  assert.equal(events.length, eventCount);
});

test('remote opening manifest restores the exact seven-tile hands and stock, rejecting duplicate tiles atomically', () => {
  for (const playerCount of [2, 3, 4]) {
    const { context: c } = onlineHarness(playerCount);
    const snapshot = settledOpeningState(c, playerCount - 1);
    Object.assign(c, { players: snapshot.players, boneyard: snapshot.boneyard, chain: snapshot.chain });
    const originalStock = c.boneyard;
    const originalHands = c.players.map((player) => player.hand);
    const invalid = structuredClone(snapshot.openingPresentation);
    invalid.hands[0][1] = invalid.hands[0][0];
    assert.equal(c.replayRemoteOpening(invalid), false);
    assert.equal(c.openingSequence, null);
    assert.equal(c.boneyard, originalStock);
    assert.equal(c.piecesG.children.filter((mesh) => mesh.spec).length, 0);
    assert.equal(c.replayRemoteOpening(snapshot.openingPresentation), true);
    const sequence = c.openingSequence;
    assert.equal(sequence.tiles.length, 28);
    assert.equal(new Set(sequence.tiles.map(({ tile }) => c.tileKey(tile))).size, 28);
    assert.equal(sequence.dealQueue.length, playerCount * 7);
    assert.equal(c.boneyard, originalStock, 'presentation changed the authoritative stock');
    for (let seat = 0; seat < playerCount; seat++) {
      assert.equal(c.players[seat].hand, originalHands[seat], 'presentation replaced the authoritative hand');
      assert.deepEqual(Array.from(sequence.handSlots[seat], c.tileKey), snapshot.openingPresentation.hands[seat].map(c.tileKey));
    }
    assert.equal(sequence.firstPlay.seat, playerCount - 1);
    assert.equal(c.tileKey(sequence.firstPlay.tile), c.tileKey(c.chain[0].tile));
    assert.equal(sequence.firstPlay.segment, c.chain[0]);
    assert.equal(c.chain[0].animating, true);
    for (const draw of sequence.dealQueue) assert.equal(draw.source.tile, draw.tile);
  }
});

test('host publishes one complete initial manifest before animation and never republishes it on completion', () => {
  const { context: c, install, events } = onlineHarness(3);
  Object.assign(c, {
    cpuMoveTimeout: null, pendingTurnAdvanceTimeout: null, flipDir: false,
    isPointsRace: false, clearWinnerHighlight() {}, hideWinnerOverlay() {}
  });
  delete c.finishOpeningTurn;
  install('startGame', 'highestDoubleIndex', 'getTileSpanAlongChain', 'DOUBLE_END_SHIFT', 'finishOpeningTurn');
  c.emitDominoOnlineState = (action) => events.push({ action, state: c.buildDominoOnlineState() });
  c.startGame();
  const emissions = events.filter((event) => event?.action);
  assert.equal(emissions.length, 1);
  assert.equal(emissions[0].action, 'initial');
  const initial = emissions[0].state;
  assert.equal(initial.chain.length, 1);
  assert.equal(initial.openingPresentation.hands.length, 3);
  assert.ok(initial.openingPresentation.hands.every((hand) => hand.length === 7));
  assert.equal(initial.current, (initial.openingPresentation.firstSeat - 1 + c.N) % c.N);
  const all = [...initial.boneyard, ...initial.players.flatMap((player) => player.hand), ...initial.chain.map((segment) => segment.tile)];
  assert.equal(all.length, 28);
  assert.equal(new Set(all.map(c.tileKey)).size, 28);
  for (let now = 0; now <= 30_000 && c.isDominoMotionBusy(); now += 34) {
    c.dominoMotionTime = now;
    c.updateOpeningSequence(now);
    c.updateDrawAnimations(now);
    c.updatePlacementAnimations(now);
  }
  assert.equal(c.isDominoMotionBusy(), false, 'initial placement never completed');
  assert.equal(events.filter((event) => event?.action).length, 1,
    'opening completion republished the initial state after turn ownership changed');
  assert.equal(c.chain[0].animating, false);
  assert.equal(c.players.reduce((count, player) => count + player.hand.length, 0), c.N * 7 - 1);
});


test('an opponent exposes the played face at pickup without relocating the domino or duplicating it', () => {
  const { context: c } = gameHarness();
  const hidden = c.makeDomino(2, 5, { faceUp: false });
  hidden.position.set(-0.42, 1.36, 0.72);
  hidden.rotation.set(0.3, 1.2, -0.4);
  hidden.scale.set(0.08, 0.13, 0.07);
  c.piecesG.add(hidden);
  hidden.updateMatrix();
  const before = hidden.matrix.clone();
  const count = c.piecesG.children.length;
  const anim = { mesh: hidden, segment: { tile: { a: 5, b: 2 } } };
  c.revealPlacementFace(anim);
  anim.mesh.updateMatrix();
  assert.deepEqual(anim.mesh.matrix.elements, before.elements);
  assert.equal(anim.mesh.spec.faceUp, true);
  assert.equal(anim.mesh.spec.preserveOrder, true);
  assert.deepEqual([anim.mesh.spec.a, anim.mesh.spec.b], [5, 2]);
  assert.equal(hidden.parent, null);
  assert.equal(c.piecesG.children.length, count);
  const visible = anim.mesh;
  c.revealPlacementFace(anim);
  assert.equal(anim.mesh, visible);
});

test('tabletop wash moves the whole set, keeps pieces flat and resolves their footprints', () => {
  const { context: c } = gameHarness(4, 731);
  c.spawnOpeningShuffleAnimation();
  const sequence = c.openingSequence;
  for (let frame = 0; frame <= 192; frame++) c.updateDominoShuffleTiles(sequence, frame / 192, frame * 1000 / 60);
  const moved = sequence.tiles.filter((entry) => entry.mesh.position.distanceTo(entry.home) > c.DOMINO_WIDTH * 0.12);
  assert.ok(moved.length >= 20, 'wash should mix the complete set, not just jiggle a few pieces');
  const diameter = Math.hypot(c.DOMINO_WIDTH, c.DOMINO_LENGTH) * 1.025;
  for (let i = 0; i < sequence.tiles.length; i++) {
    const entry = sequence.tiles[i];
    assert.ok(entry.mesh.position.toArray().every(Number.isFinite));
    assert.equal(entry.mesh.position.y, entry.home.y);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(entry.mesh.quaternion);
    assert.ok(normal.y < -0.999999, 'washing must never reveal or tilt a tile');
    for (let j = i + 1; j < sequence.tiles.length; j++) {
      const other = sequence.tiles[j];
      const distance = Math.hypot(entry.mesh.position.x - other.mesh.position.x, entry.mesh.position.z - other.mesh.position.z);
      assert.ok(distance > diameter * 0.97, 'tiles remain visibly interpenetrating after the wash');
    }
  }
});
