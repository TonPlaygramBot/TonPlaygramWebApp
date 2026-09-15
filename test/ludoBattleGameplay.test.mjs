import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { canRollLudoDice } from '../shared/ludoBattleRules.js';

const requireWebapp = createRequire(new URL('../webapp/package.json', import.meta.url));
const { parse } = requireWebapp('@babel/parser');
const THREE = requireWebapp('three');
const source = readFileSync(new URL('../webapp/src/pages/Games/LudoBattleRoyal.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const component = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'Ludo3D');

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
  assert.match(source, /const SEATED_HUMAN_ACTOR_TARGET_HEIGHT = SEATED_HUMAN_BASE_HEIGHT \* 0\.84;/);
  assert.match(source, /const SEATED_HUMAN_TARGET_HEIGHT = BACK_HEIGHT \* 2\.42;/);
  assert.match(source, /const SEATED_HUMAN_VISUAL_SCALE_MULTIPLIER = 4\.2;/);
  assert.match(source, /const SEATED_HUMAN_SEAT_Y_OFFSET = -6\.75 \* MODEL_SCALE \* STOOL_SCALE;/);
  assert.match(source, /const SEATED_HUMAN_SEAT_Z_OFFSET = -SEAT_DEPTH \* 0\.42;/);
  assert.match(source, /const SELF_BOTTOM_HUMAN_EXTRA_Z_OFFSET = SEAT_DEPTH \* 0\.12;/);
  assert.match(source, /const SEATED_HUMAN_FOOT_GROUND_CLEARANCE = -1\.55 \* MODEL_SCALE \* STOOL_SCALE;/);
  assert.match(source, /actor\.scale\.multiplyScalar\(SEATED_HUMAN_ACTOR_TARGET_HEIGHT \/ Math\.max\(height, 0\.01\)\);/);
  assert.match(source, /humanCharacterIndex: humanPool\[aiIndex % humanPool\.length\] \?\? 0/);
  assert.match(source, /\{ key: 'humanCharacter', label: 'Human Character', options: HUMAN_CHARACTER_OPTIONS \}/);
  assert.match(source, /requestCharacter\?\.\(HUMAN_CHARACTER_OPTIONS\[safe\.humanCharacter\]\)/);
});

test('human dice pickup and landing positions remain on the restored choreography', () => {
  assert.match(source, /if \(player === 0 && !immediate\) \{[\s\S]*beginDiceHoldPose\(player, \{ startMs: performance\.now\(\) - 220 \}\);[\s\S]*return;/);
  assert.match(source, /const target = resolveDiceHoldContactTarget\(player, railTarget\) \?\? railTarget;/);
  assert.match(source, /diceObj\.userData\.railPositions = rails;/);
  assert.match(source, /diceObj\.userData\.homeLandingTargets/);
  assert.doesNotMatch(source, /tabletopDiceLane/);
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
  const die = { position: new THREE.Vector3(1, 2, 3) };
  const result = spin(die, { isCurrent: () => false });
  frames.shift()();
  assert.equal(await result, null);
  assert.deepEqual(die.position.toArray(), [1, 2, 3]);
  assert.equal(frames.length, 0);
});
