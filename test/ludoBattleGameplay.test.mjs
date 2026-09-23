import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { canRollLudoDice } from '../shared/ludoBattleRules.js';
import { hasVisibleLudoToken, setLudoTileHighlight, updateLudoTileGlow } from '../webapp/src/utils/ludoTokenPresentation.ts';

const requireWebapp = createRequire(new URL('../webapp/package.json', import.meta.url));
const { parse } = requireWebapp('@babel/parser');
const THREE = requireWebapp('three');
const source = readFileSync(new URL('../webapp/src/pages/Games/LudoBattleRoyal.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'Ludo3D');

test('the shipped token builder clones all 16 pieces from the restored GLTF prototypes', () => {
  const build = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'buildLudoBoard');
  const tokens = build.body.body.find((node) => node.declarations?.some((declaration) => declaration.id.name === 'tokens'));
  const scene = new THREE.Group(), colors = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e];
  const dependencies = {
    THREE, scene, playerColors: colors, playerCount: 4,
    tokenPieceByPlayer: [{ type: 'p' }, { type: 'r' }, { type: 'n' }, { type: 'k' }],
    defaultTokenTypeSequence: ['p'], shouldUseAbgTokens: true, abgPrototypes: {},
    resolveAbgColorKey: () => 'w', resolveAbgPrototype: () => new THREE.Mesh(
      new THREE.CylinderGeometry(.02, .03, .08),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    ),
    cloneAbgToken: (prototype) => prototype.clone(),
    tintGltfToken: (piece, color) => piece.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.color.set(color);
      }
    }),
    TOKEN_SIZE_MULTIPLIER: 1.24,
    TOKEN_TYPE_SCALE_PROFILE: {}, TOKEN_THINNESS_SCALE: .76, TOKEN_HEIGHT_SCALE: 1.1,
    createTokenCountLabel: () => null, colorNumberToHex: (color) => `#${new THREE.Color(color).getHexString()}`,
    applyTokenFacingRotation: () => {}, getTokenRailHeight: () => .025,
    startPads: colors.map((_, player) => Array.from({ length: 4 }, (_, index) => new THREE.Vector3(player * .15, 0, index * .08)))
  };
  const result = Function(...Object.keys(dependencies), `${source.slice(tokens.start, tokens.end)}; return tokens;`)(...Object.values(dependencies));
  const highlightNode = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'setTokenHighlight');
  const select = Function('THREE', 'TOKEN_SELECTION_SCALE', `return (${source.slice(highlightNode.start, highlightNode.end)});`)(THREE, 1.08);
  assert.equal(scene.children.length, 16);
  result.forEach((pieces, player) => pieces.forEach((piece, index) => {
    assert.ok(hasVisibleLudoToken(piece));
    assert.equal(piece.userData.playerIndex, player);
    assert.equal(piece.userData.tokenIndex, index);
    assert.equal(new THREE.Color(piece.userData.tokenColor).getHex(), colors[player]);
    piece.traverse((child) => assert.equal(child.userData.tokenGroup, piece, 'GLTF piece lost its selection target'));
    const scale = piece.scale.clone();
    select(piece, true); select(piece, false);
    assert.ok(piece.scale.equals(scale));
    piece.traverse((child) => {
      if (child.isMesh) {
        assert.equal(child.material.color.getHex(), colors[player]);
      }
    });
  }));
});

test('the real movement frame lights a tile on landing, then fades after completion in the token color', () => {
  const tile = new THREE.Mesh(new THREE.BoxGeometry(.069, .018, .069), new THREE.MeshStandardMaterial({ color: 0xf4e3bd }));
  tile.userData.boardTile = { baseColor: tile.material.color.clone() };
  const base = tile.material.color.clone();
  const token = new THREE.Object3D(); token.userData.tokenColor = '#ad52f1';
  let completions = 0, sounds = 0;
  const animation = { token, player: 0, active: true, segment: 0, elapsed: 0,
    segments: [{ from: new THREE.Vector3(), to: new THREE.Vector3(.075, 0, 0), duration: .34 }],
    highlightTiles: [tile], activeHighlightTiles: [], highlightIndex: -1, onComplete: () => completions++ };
  const stateRef = { current: { animation, trackTiles: [tile], homeColumnTiles: [] } };
  const useCallback = (callback) => callback;
  const clear = controller('clearAnimationHighlights', { useCallback, setTileHighlight: setLudoTileHighlight });
  const highlight = controller('updateAnimationHighlight', { useCallback, clearAnimationHighlights: clear,
    setTileHighlight: setLudoTileHighlight, playerColorsRef: { current: [0x3b82f6] }, DEFAULT_PLAYER_COLORS: [0xef4444], THREE });
  const begin = source.indexOf('// Pulses outlive the movement');
  const end = source.indexOf('const actorState = seatedHumanActionRef.current;', begin);
  const dependencies = { stateRef, THREE, updateLudoTileGlow, updateAnimationHighlight: highlight,
    clearAnimationHighlights: clear, playTokenStepSound: () => sounds++, updateTokenStacks: () => {},
    animTemp: new THREE.Vector3(), animDir: new THREE.Vector3(), animLook: new THREE.Vector3(),
    TOKEN_STEP_JUMP_PHASE: .2, TOKEN_STEP_JUMP_HEIGHT: .03 };
  const frame = Function(...Object.keys(dependencies), `return (delta) => { const state = stateRef.current; ${source.slice(begin, end)} };`)(...Object.values(dependencies));
  frame(.17);
  assert.ok(tile.material.color.equals(base), 'destination lit before the token landed');
  assert.equal(sounds, 0);
  frame(.17);
  assert.equal(tile.material.color.getHex(), 0xad52f1, 'glow used a default player color');
  assert.equal(completions, 1); assert.equal(sounds, 1);
  assert.equal(stateRef.current.animation, null);
  assert.ok(tile.userData.boardTile.isHighlighted, 'completion erased the last landing');
  frame(.4);
  assert.ok(tile.userData.boardTile.isHighlighted);
  frame(.5);
  assert.ok(tile.material.color.equals(base));
  assert.equal(tile.userData.boardTile.isHighlighted, false);
});

// Exercise the shipped controller closures with controlled scene objects and
// deferred React updates. No duplicate implementation or production test hook.
function controller(name, dependencies) {
  const declaration = component.body.body.flatMap((node) => node.declarations || []).find((node) => node.id.name === name);
  const assignment = component.body.body.find((node) => node.type === 'ExpressionStatement' &&
    node.expression.type === 'AssignmentExpression' && node.expression.left.object?.name === name);
  const expression = assignment?.expression.right || declaration?.init;
  assert.ok(expression, `controller ${name} must exist`);
  return Function(...Object.keys(dependencies), `return (${source.slice(expression.start, expression.end)});`)(...Object.values(dependencies));
}

const noop = () => {};

test('portrait seated-human sizing and character selection remain wired to the restored implementation', () => {
  assert.match(source, /const SEATED_HUMAN_TARGET_HEIGHT = BACK_HEIGHT \* 2\.42;/);
  assert.match(source, /const SEATED_HUMAN_VISUAL_SCALE_MULTIPLIER = 4\.2;/);
  assert.match(source, /const SEATED_HUMAN_SEAT_Y_OFFSET = -6\.75 \* MODEL_SCALE \* STOOL_SCALE;/);
  assert.match(source, /const SEATED_HUMAN_SEAT_Z_OFFSET = -SEAT_DEPTH \* 0\.42;/);
  assert.match(source, /const SELF_BOTTOM_HUMAN_EXTRA_Z_OFFSET = SEAT_DEPTH \* 0\.12;/);
  assert.match(source, /const SEATED_HUMAN_FOOT_GROUND_CLEARANCE = -1\.55 \* MODEL_SCALE \* STOOL_SCALE;/);
  assert.match(source, /const humanOption = HUMAN_CHARACTER_OPTIONS\[humanIndex\] \?\? HUMAN_CHARACTER_OPTIONS\[0\];/);
  assert.match(source, /humanTemplate = await loadSeatedHumanTemplate\(renderer, humanOption\);/);
  assert.match(source, /actor\.scale\.setScalar\(baseScale\);/);
  assert.match(source, /actor\.position\.set\(0, SEATED_HUMAN_SEAT_Y_OFFSET, seatZOffset\);/);
  assert.match(source, /humanCharacterIndex: humanPool\[aiIndex % humanPool\.length\] \?\? 0/);
  assert.match(source, /\{ key: 'humanCharacter', label: 'Human Character', options: HUMAN_CHARACTER_OPTIONS \}/);
});

test('remote humans reach the landed die while the bottom human waits for the press', () => {
  assert.match(source, /if \(player === 0\) \{[\s\S]*holdPlayer: null,[\s\S]*holdStartMs: 0[\s\S]*return;/);
  assert.match(source, /if \(isHumanTurn\) beginDiceHoldPose\(player\);/);
  assert.match(source, /if \(online\?\.tableId\) \{[\s\S]*beginDiceHoldPose\(player\);[\s\S]*dice\.userData\.isRolling = true;/);
  assert.doesNotMatch(source, /animateDicePosition\(dice, target/);
  assert.match(source, /diceObj\.userData\.railPositions = rails;/);
  assert.match(source, /diceObj\.userData\.homeLandingTargets/);
  assert.doesNotMatch(source, /tabletopDiceLane/);
});

test('Ludo tokens use the restored A Beautiful Game GLTF clone path', () => {
  assert.match(source, /const useAbgTokens = true;[\s\S]*await getAbgAssets\(\)/);
  assert.match(source, /const proto = resolveAbgPrototype\(abgPrototypes, colorKey, type\);[\s\S]*token = cloneAbgToken\(proto\);/);
  assert.match(source, /const fallbackProto =[\s\S]*resolveAbgPrototype\(abgPrototypes, 'w', type\)[\s\S]*token = cloneAbgToken\(fallbackProto\) \|\| new THREE\.Group\(\);/);
  assert.doesNotMatch(source, /createFallbackLudoToken\(type/);
});

test('rapid taps cannot clear the pending move or turn timer', async () => {
  for (const patch of [{ pendingRoll: 6 }, { onlinePendingRoll: 3 }, { winner: 0 }, { animation: {} }]) {
    const roll = controller('rollDice', {
      stateRef: { current: { winner: null, ...patch } },
      diceRef: { current: { userData: {} } },
      humanSelectionRef: { current: null },
      turnAdvanceTimeoutRef: { current: null },
      canRollLudoDice,
      clearHumanRollTimeout: () => assert.fail('rejected roll cleared turn state')
    });
    await roll();
  }
});

test('turn advancement schedules the human roll even when React defers the updater', () => {
  const state = { turn: 1, winner: null, pendingRoll: 2 };
  const queuedUpdates = [];
  let autoRolls = 0;
  const advance = controller('advanceTurn', {
    stateRef: { current: state }, onlineContextRef: { current: null }, activePlayerCount: 2,
    clearTurnAdvanceTimeout: noop, clearHumanSelection: noop, cancelCameraFocusAnimation: noop,
    updateTurnIndicator: noop, preserveUserTurnCameraRef: {}, lockUserTurnSeatViewRef: {},
    setCameraViewForTurn: noop, CAMERA_TURN_VIEW_DURATION_MS: 0, diceRef: { current: null },
    COLOR_NAMES: ['Red', 'Blue'], setUi: (update) => queuedUpdates.push(update),
    scheduleDiceClear: noop, clearHumanRollTimeout: noop, aiTimeoutRef: { current: null },
    scheduleHumanAutoRoll: () => autoRolls++
  });
  advance(false);
  assert.equal(state.turn, 0);
  assert.equal(state.pendingRoll, null);
  assert.equal(autoRolls, 1);
  assert.equal(queuedUpdates[0]({ turn: 1, turnCycle: 2 }).turnCycle, 3);
  assert.equal(autoRolls, 1, 'replaying the updater must not schedule another roll');
});

test('the final authoritative progress displays in the goal slots', () => {
  const home = new THREE.Vector3(1, 1, 1);
  const goal = new THREE.Vector3(2, 2, 2);
  const locate = controller('getWorldForProgress', {
    stateRef: { current: { homeColumns: [Array(6).fill(home)], goalSlots: [[goal]] } },
    THREE, RING_STEPS: 52, GOAL_PROGRESS: 57,
    TOKEN_TRACK_LIFT: new THREE.Vector3(), TOKEN_GOAL_LIFT: new THREE.Vector3()
  });
  assert.deepEqual(locate(0, 56, 0).toArray(), home.toArray());
  assert.deepEqual(locate(0, 57, 0).toArray(), goal.toArray());
});

test('a newer online sync cannot be overwritten by an old movement animation', () => {
  const state = {
    progress: [[0, -1, -1, -1], [0, -1, -1, -1]], turn: 0, winner: null,
    onlineRevision: 1,
    tokens: Array.from({ length: 2 }, () => Array.from({ length: 4 }, () => ({ position: new THREE.Vector3() })))
  };
  const stateRef = { current: state };
  let finishOldMove;
  let animations = 0;
  let clears = 0;
  const apply = controller('applyOnlineStateRef', {
    stateRef, onlineContextRef: { current: { accountId: 'a' } }, activePlayerCount: 2,
    onlinePresentationVersionRef: { current: 0 }, pendingOnlineStateRef: { current: null },
    clearTurnAdvanceTimeout: noop, clearAnimationHighlights: () => clears++,
    getWorldForProgress: (player, progress) => new THREE.Vector3(player, progress, 0),
    applyTokenFacingRotation: noop, updateTokenStacks: noop, updateTurnIndicator: noop,
    COLOR_NAMES: ['Red', 'Blue'], setUi: noop, diceRef: { current: null },
    clearHumanSelection: noop,
    scheduleMove: (player, token, target, complete) => {
      animations++;
      state.animation = { player, token };
      finishOldMove = complete;
    }
  });
  const move = { state: { players: ['a', 'b'], progress: [[0, -1, -1, -1], [1, -1, -1, -1]],
    turn: 0, pendingRoll: null, winner: null, revision: 2 }, action: { type: 'move', player: 1, token: 0, to: 1 } };
  apply(move);
  apply(move);
  assert.equal(animations, 1, 'duplicate revision replayed movement');
  const syncedProgress = [[4, -1, -1, -1], [1, -1, -1, -1]];
  apply({ state: { ...move.state, progress: syncedProgress, revision: 3 }, action: { type: 'sync' } });
  assert.equal(clears, 1);
  finishOldMove();
  assert.deepEqual(state.progress, syncedProgress);
  assert.equal(state.onlineRevision, 3);
  assert.equal(state.animation, null);
});

test('a superseded dice animation stops before touching the die', async () => {
  const spinNode = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'spinDice');
  const frames = [];
  const spin = Function('THREE', 'requestAnimationFrame', `return (${source.slice(spinNode.start, spinNode.end)});`)(THREE, (frame) => frames.push(frame));
  const die = new THREE.Object3D();
  die.position.set(1, 2, 3);
  const result = spin(die, { isCurrent: () => false });
  frames.shift()();
  assert.equal(await result, null);
  assert.deepEqual(die.position.toArray(), [1, 2, 3]);
  assert.equal(frames.length, 0);
});


test('starting a throw preserves the die position until the animation releases it', async () => {
  const dice = new THREE.Object3D(); new THREE.Group().add(dice);
  dice.position.set(0.1, 0.2, 0.3);
  const contact = {};
  const entry = { playerIndex: 0, diceHand: {}, diceReach: { contact }, diceGrip: 1 };
  const state = { current: { holdPlayer: 0, holdStartMs: 1 } };
  const sync = controller('syncDiceToThrowHand', {
    useCallback: (fn) => fn,
    seatedHumanActorsRef: { current: [entry] }, seatedHumanActionRef: state,
    createLudoDiceThrow: (received, die, destination) => {
      assert.equal(received, contact); assert.equal(die, dice);
      assert.deepEqual(destination.toArray(), [0.5, 0.2, 0.5]); return {};
    }
  });
  const pending = sync(0, dice, { targetPosition: new THREE.Vector3(0.5, 0.2, 0.5) });
  assert.deepEqual(dice.position.toArray(), [0.1, 0.2, 0.3]);
  assert.equal(state.current.holdPlayer, null);
  assert.ok(entry.diceMotion);
  entry.diceMotion.resolve(false); // Same completion used by reset/unmount.
  assert.equal(await pending, false);
  assert.equal(await sync(0, dice, { isCurrent: () => false }), false);
  assert.deepEqual(dice.position.toArray(), [0.1, 0.2, 0.3]);
});

test('dice flight agrees at 30, 60 and 120 Hz and keeps the authoritative face', async () => {
  const spinNode = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'spinDice');
  const rotations = [];
  for (const hz of [30, 60, 120]) {
    let now = 0;
    const frames = [];
    const spin = Function('THREE', 'requestAnimationFrame', 'performance', 'Math', 'easeOutCubic',
      `return (${source.slice(spinNode.start, spinNode.end)});`)(THREE, (frame) => frames.push(frame),
      { now: () => now }, Object.assign(Object.create(Math), { random: () => 0.5 }), (t) => 1 - (1 - t) ** 3);
    const die = new THREE.Object3D();
    let resultFace = null;
    die.userData.setValue = (face) => { resultFace = face; };
    const target = new THREE.Vector3(0.3, 0.1, 0.2);
    const result = spin(die, { duration: 1000, targetPosition: target, value: 5 });
    for (let frame = 1; frame <= hz; frame++) {
      now = frame / hz * 1000; frames.shift()();
      if (frame === hz / 2) rotations.push(die.quaternion.clone());
    }
    assert.equal(await result, 5); assert.equal(resultFace, 5);
    assert.ok(die.position.equals(target)); assert.equal(frames.length, 0);
  }
  assert.ok(rotations[0].angleTo(rotations[1]) < 1e-7);
  assert.ok(rotations[1].angleTo(rotations[2]) < 1e-7);
});
