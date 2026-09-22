import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse } from '@babel/parser';
import * as THREE from '../webapp/node_modules/three/build/three.cjs';
import { resolvePoolRoyalReleasePower } from '../webapp/src/pages/Games/poolRoyaleShotState.js';

// Exercise the functions used by the live JSX, without mounting its WebGL scene.
const source = fs.readFileSync(new URL('../webapp/src/pages/Games/PoolRoyale.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const nodes = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if ((node.type === 'VariableDeclarator' || node.type === 'FunctionDeclaration') &&
      ['isHumanReadyForShot', 'processPreparedShot', 'fire'].includes(node.id?.name)) {
    nodes.set(node.id.name, node.type === 'VariableDeclarator' ? node.init : node);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
const load = (name, scope) => {
  const node = nodes.get(name);
  assert.ok(node, `${name} must exist in the live game`);
  return new Function(...Object.keys(scope), `return (${source.slice(node.start, node.end)});`)(...Object.values(scope));
};

function harness({ players = { readyToShoot: false, players: [
  { seat: 'A', state: 'walking' }, { seat: 'B', state: 'idle' }
] }, disposed = false } = {}) {
  const preparationStates = [];
  const fireCalls = [];
  const timerClears = [];
  const cue = { id: 'cue', active: true, pos: new THREE.Vector2(2, 3), vel: new THREE.Vector2() };
  const objectBall = { id: 'ball_1', active: true, pos: new THREE.Vector2(5, 6), vel: new THREE.Vector2() };
  const balls = [cue, objectBall];
  const scope = {
    THREE, referencePlayers: players, disposed, cue, balls,
    BALL_R: 1, MIN_SHOT_POWER_TO_FIRE: 0.02, resolvePoolRoyalReleasePower,
    ballsRef: { current: balls },
    frameRef: { current: { activePlayer: 'A', meta: { state: {} } } },
    frameState: { activePlayer: 'A' },
    hudRef: { current: { turn: 0, inHand: false, over: false } },
    shootingRef: { current: false }, cueStrokeStateRef: { current: null },
    pendingImpactRef: { current: null }, shotPreparationRef: { current: null },
    replayPlaybackRef: { current: null },
    aimDirRef: { current: new THREE.Vector2(0.6, 0.8) },
    spinRequestRef: { current: { x: 0.2, y: -0.4 } },
    spinRef: { current: { x: 0, y: 0 } },
    powerRef: { current: 0.08 },
    cueBallPlacedFromHandRef: { current: true },
    breakRollStateRef: { current: 'done' }, timerRef: { current: 123 },
    allowFullTableInHand: () => true,
    allStopped: list => list.every(ball => !ball.active || ball.vel.lengthSq() === 0),
    setShotPreparing: state => preparationStates.push(state),
    setInHandPlacementMode: () => {}, setBreakRollState: () => {},
    clearInterval: value => timerClears.push(value)
  };
  scope.setHud = updater => { scope.hudRef.current = updater(scope.hudRef.current); };
  scope.isHumanReadyForShot = load('isHumanReadyForShot', scope);
  scope.fire = power => fireCalls.push({
    power, aim: scope.aimDirRef.current.toArray(),
    spin: { ...scope.spinRef.current }, requestedSpin: { ...scope.spinRequestRef.current },
    queued: scope.shotPreparationRef.current
  });
  const process = load('processPreparedShot', scope);
  const request = load('fire', scope);
  const prepare = (power = 0.74) => {
    scope.shotPreparationRef.current = {
      power, aim: new THREE.Vector2(0.6, 0.8), spin: { x: 0.2, y: -0.4 },
      seat: 'A', cuePosition: cue.pos.clone()
    };
    return scope.shotPreparationRef.current;
  };
  const ready = () => {
    if (!players) return;
    players.readyToShoot = true;
    const active = players.players.find(player => player.seat === scope.frameRef.current.activePlayer);
    if (active) active.state = 'dragging';
  };
  return { scope, request, process, prepare, ready, preparationStates, fireCalls, timerClears, objectBall };
}

test('live readiness waits for the active player to finish walking and settle into the aiming stance', () => {
  const game = harness();
  assert.equal(game.scope.isHumanReadyForShot(), false);
  game.scope.referencePlayers.readyToShoot = true;
  assert.equal(game.scope.isHumanReadyForShot(), false);
  game.ready();
  assert.equal(game.scope.isHumanReadyForShot(), true);
  game.scope.frameRef.current.activePlayer = 'B';
  assert.equal(game.scope.isHumanReadyForShot(), false);
  game.scope.referencePlayers.players[1].state = 'dragging';
  assert.equal(game.scope.isHumanReadyForShot(), true);
  game.scope.referencePlayers.readyToShoot = false;
  assert.equal(game.scope.isHumanReadyForShot(), false);
});

test('live release captures power, direction and spin before the player is ready, once only', () => {
  const game = harness();
  game.request(0.74);
  const captured = game.scope.shotPreparationRef.current;
  assert.ok(captured);
  assert.equal(captured.power, 0.74);
  assert.deepEqual(captured.aim.toArray(), [0.6, 0.8]);
  assert.deepEqual(captured.spin, { x: 0.2, y: -0.4 });
  assert.deepEqual(captured.cuePosition.toArray(), [2, 3]);
  assert.equal(captured.seat, 'A');
  assert.deepEqual(game.preparationStates, [true]);
  assert.deepEqual(game.timerClears, [123]);
  game.scope.aimDirRef.current.set(-1, 0);
  game.scope.spinRequestRef.current.x = -0.3;
  game.scope.powerRef.current = 0.05;
  game.request(0.9);
  assert.equal(game.scope.shotPreparationRef.current, captured);
  assert.equal(captured.power, 0.74);
  assert.deepEqual(captured.aim.toArray(), [0.6, 0.8]);
  assert.deepEqual(captured.spin, { x: 0.2, y: -0.4 });
  assert.deepEqual(game.preparationStates, [true]);
});

test('prepared shot waits, restores captured controls and fires exactly once when the human is ready', () => {
  const game = harness();
  game.request(0.74);
  game.scope.aimDirRef.current.set(-1, 0);
  game.scope.spinRequestRef.current = { x: -0.1, y: 0.3 };
  game.scope.spinRef.current = { x: 0, y: 0 };
  game.scope.powerRef.current = 0.01;
  for (let i = 0; i < 5; i += 1) game.process();
  assert.equal(game.fireCalls.length, 0);
  assert.ok(game.scope.shotPreparationRef.current);
  assert.deepEqual(game.preparationStates, [true]);
  game.ready();
  game.process();
  assert.equal(game.scope.shotPreparationRef.current, null);
  assert.deepEqual(game.preparationStates, [true, false]);
  assert.equal(game.scope.powerRef.current, 0.74);
  assert.deepEqual(game.fireCalls, [{
    power: 0.74, aim: [0.6, 0.8], spin: { x: 0.2, y: -0.4 },
    requestedSpin: { x: 0.2, y: -0.4 }, queued: null
  }]);
  assert.notEqual(game.scope.spinRequestRef.current, game.scope.spinRef.current);
  game.process();
  game.process();
  assert.equal(game.fireCalls.length, 1);
});

for (const [reason, invalidate] of [
  ['turn changed', game => { game.scope.frameRef.current.activePlayer = 'B'; }],
  ['cue position changed', game => { game.scope.cue.pos.x += 0.01; }],
  ['another ball started moving', game => { game.objectBall.vel.x = 0.1; }],
  ['another shot started', game => { game.scope.shootingRef.current = true; }],
  ['replay started', game => { game.scope.replayPlaybackRef.current = {}; }],
  ['game ended', game => { game.scope.hudRef.current.over = true; }],
  ['cue was removed', game => { game.scope.cue.active = false; }]
]) {
  test(`prepared shot cancels immediately when ${reason}`, () => {
    const game = harness();
    game.prepare();
    invalidate(game);
    game.process();
    assert.equal(game.scope.shotPreparationRef.current, null);
    assert.deepEqual(game.preparationStates, [false]);
    assert.equal(game.fireCalls.length, 0);
    game.ready();
    game.process();
    assert.equal(game.fireCalls.length, 0);
  });
}

test('prepared shot cancels on scene disposal without invoking the previous scene fire function', () => {
  const game = harness({ disposed: true });
  game.prepare();
  game.process();
  assert.equal(game.scope.shotPreparationRef.current, null);
  assert.equal(game.fireCalls.length, 0);
});

test('tiny harmless cue-position roundoff does not cancel a prepared shot', () => {
  const game = harness();
  game.prepare();
  game.scope.cue.pos.x += game.scope.BALL_R * 0.0001;
  game.ready();
  game.process();
  assert.equal(game.fireCalls.length, 1);
});

for (const [label, players] of [
  ['missing human system', null],
  ['models still unavailable', { readyToShoot: false, players: [] }],
  ['one model failed to load', { readyToShoot: false, players: [{ seat: 'A', state: 'idle' }] }]
]) {
  test(`${label} cannot deadlock a prepared shot`, () => {
    const game = harness({ players });
    game.prepare();
    assert.equal(game.scope.isHumanReadyForShot(), true);
    game.process();
    assert.equal(game.scope.shotPreparationRef.current, null);
    assert.equal(game.fireCalls.length, 1);
    assert.deepEqual(game.preparationStates, [false]);
  });
}
