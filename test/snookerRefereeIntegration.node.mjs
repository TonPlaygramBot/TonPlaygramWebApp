import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import ts from 'typescript';
import * as THREE from '../webapp/node_modules/three/build/three.module.js';
import { buildSnookerViewerHud } from '../webapp/src/pages/Games/snookerRoyalMatchQuality.js';

const rulesSource = await readFile(new URL('../src/rules/SnookerRoyalRules.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(rulesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
});
const { SnookerRoyalRules } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const source = await readFile(new URL('../webapp/src/pages/Games/SnookerRoyal.jsx', import.meta.url), 'utf8');
const callbacks = new Map();
let attachReplacementLayout;
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && node.id?.name && node.init) callbacks.set(node.id.name, node.init);
  if (node.type === 'IfStatement' && source.slice(node.test.start, node.test.end).startsWith('safeState.meta?.foulChoice?.miss'))
    attachReplacementLayout = node;
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach(walk);
    else if (child?.type) walk(child);
  }
}
walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
const install = (context, name) => {
  const node = callbacks.get(name);
  context[name] = vm.runInContext(`(${source.slice(node.start, node.end)})`, context);
};

function refereeRig() {
  const balls = ['cue', 'RED_1'].map((id, i) => {
    const ball = { id, active: true, pos: new THREE.Vector2(i + 1, i + 3),
      vel: new THREE.Vector2(), spin: new THREE.Vector2(), pendingSpin: new THREE.Vector2(),
      omega: new THREE.Vector3(), mesh: new THREE.Object3D(), shadow: new THREE.Object3D() };
    ball.mesh.position.set(ball.pos.x, 5, ball.pos.y);
    return ball;
  });
  const rules = new SnookerRoyalRules();
  const emitted = [];
  const c = {
    THREE, balls, rules, BALL_CENTER_Y: 5, BALL_SHADOW_Y: 4,
    pocketDropRef: { current: new Map() },
    shotActive: false, isPlayerTurn: true, hud: { over: false },
    frameRef: { current: null }, hudRef: { current: {} },
    localSeatRef: { current: 'B' }, cueBallPlacedFromHandRef: { current: true },
    applyBallSnapshotRef: { current: null }, captureBallSnapshotRef: { current: null },
    buildSnookerViewerHud, isOnlineMatch: true, tableId: 'test-snooker-table',
    accountIdRef: { current: 'seat-b-account' }, accountId: '',
    socket: { emit: (event, payload) => emitted.push({ event, payload }) },
    setFrameState(value) { c.renderedFrame = value; }, setHud(value) { c.renderedHud = value; },
    turnCycle: 0, setTurnCycle(update) { c.turnCycle = update(c.turnCycle); }
  };
  vm.createContext(c);
  for (const name of ['serializeVector3Snapshot', 'serializeQuaternionSnapshot', 'normalizeVector3Snapshot',
    'normalizeQuaternionSnapshot', 'captureBallSnapshot', 'applyBallSnapshot', 'resolveRefereeChoice']) install(c, name);
  c.applyBallSnapshotRef.current = c.applyBallSnapshot;
  c.captureBallSnapshotRef.current = c.captureBallSnapshot;
  const layout = c.captureBallSnapshot();
  const initial = rules.getInitialFrame('Player A', 'Player B');
  initial.players.A.score = 8; initial.players.B.score = 13;
  c.safeState = rules.applyShot(initial, [], {
    clearPathToBallOn: true, fullBallContactAvailable: true
  });
  c.shotContextRef = { current: { preShotLayout: layout } };
  vm.runInContext(source.slice(attachReplacementLayout.start, attachReplacementLayout.end), c);
  const frame = c.safeState;
  assert.equal(frame.meta.foulChoice.offender, 'A');
  assert.ok(frame.meta.foulChoice.replacement);
  assert.equal(frame.players.B.score, 17);
  c.frameRef.current = frame;
  c.hudRef.current = buildSnookerViewerHud(frame, {}, 'B');
  for (const ball of balls) {
    ball.active = false; ball.pos.set(40, 60); ball.mesh.position.set(40, -10, 60);
    ball.mesh.visible = false; ball.mesh.scale.setScalar(.1);
    ball.vel.set(2, 3); ball.spin.set(4, 5); ball.pendingSpin.set(6, 7); ball.omega.set(8, 9, 10);
    ball.lift = 3; ball.liftVel = 4; ball.spinMode = 'swerve'; ball.swerveStrength = 2;
    ball.swervePowerStrength = 3; ball.impacted = true; ball.launchDir = new THREE.Vector2(1, 0);
    ball.shadow.visible = false; c.pocketDropRef.current.set(ball.id, { falling: true });
  }
  return { c, balls, frame, layout, emitted };
}

test('replace restores the real table and pocket animation state while preserving foul points online', () => {
  const { c, balls, frame, layout, emitted } = refereeRig();
  c.resolveRefereeChoice('replace');
  assert.equal(c.frameRef.current.players.A.score, frame.players.A.score);
  assert.equal(c.frameRef.current.players.B.score, 17);
  assert.equal(c.frameRef.current.activePlayer, 'A');
  assert.equal(c.hudRef.current.turn, 1, 'seat B now waits for the offender to replay');
  assert.equal(c.cueBallPlacedFromHandRef.current, false);
  assert.equal(c.pocketDropRef.current.size, 0);
  for (const [i, ball] of balls.entries()) {
    const snapshot = layout[i];
    assert.equal(ball.active, true);
    assert.deepEqual(ball.pos.toArray(), [snapshot.pos.x, snapshot.pos.y]);
    assert.deepEqual(ball.mesh.position.toArray(), [snapshot.mesh.position.x, snapshot.mesh.position.y, snapshot.mesh.position.z]);
    assert.deepEqual(ball.mesh.scale.toArray(), [1, 1, 1]);
    assert.equal(ball.mesh.visible, true); assert.equal(ball.shadow.visible, true);
    assert.deepEqual(ball.shadow.position.toArray(), [snapshot.pos.x, 4, snapshot.pos.y]);
    for (const vector of [ball.vel, ball.spin, ball.pendingSpin, ball.omega]) assert.equal(vector.lengthSq(), 0);
    for (const field of ['lift', 'liftVel', 'swerveStrength', 'swervePowerStrength']) assert.equal(ball[field], 0);
    assert.equal(ball.spinMode, 'standard'); assert.equal(ball.impacted, false); assert.equal(ball.launchDir, null);
  }
  assert.equal(emitted.length, 1); assert.equal(emitted[0].event, 'snookerShot');
  assert.deepEqual(emitted[0].payload.layout, layout, 'remote viewer receives the restored physical table');
  assert.equal(emitted[0].payload.state.players.B.score, 17);
  assert.equal(c.turnCycle, 1);
});

test('play continues from the existing table and keeps the awarded penalty', () => {
  const { c, balls, emitted } = refereeRig();
  const before = c.captureBallSnapshot();
  c.resolveRefereeChoice('play');
  assert.equal(c.frameRef.current.activePlayer, 'B');
  assert.equal(c.frameRef.current.players.B.score, 17);
  assert.equal(c.hudRef.current.turn, 0);
  assert.deepEqual(c.captureBallSnapshot(), before);
  assert.equal(c.pocketDropRef.current.size, 2);
  assert.ok(balls.every(ball => ball.vel.lengthSq() > 0), 'no replacement/reset callback ran');
  assert.deepEqual(emitted[0].payload.layout, before);
});

test('referee choices cannot run during a shot, on another turn, after frame end, or without a replacement layout', () => {
  for (const blocked of ['shot', 'turn', 'over', 'layout']) {
    const { c, frame, emitted } = refereeRig();
    if (blocked === 'shot') c.shotActive = true;
    if (blocked === 'turn') c.isPlayerTurn = false;
    if (blocked === 'over') c.hud.over = true;
    if (blocked === 'layout') delete frame.meta.foulChoice.layout;
    c.resolveRefereeChoice('replace');
    assert.equal(c.frameRef.current, frame);
    assert.equal(c.turnCycle, 0); assert.equal(emitted.length, 0);
  }
});

test('deciding-black toss winner can play or choose the opponent through the actual online referee callback', () => {
  for (const choice of ['play', 'opponent']) {
    const { c, emitted } = refereeRig();
    const initial = c.rules.getInitialFrame('Player A', 'Player B');
    initial.phase = 'COLORS_ORDER'; initial.redsRemaining = 0; initial.ballOn = ['BLACK'];
    initial.meta.colorsRemaining = ['BLACK'];
    initial.players.A.score = 10; initial.players.B.score = 17;
    initial.balls.forEach(ball => {
      ball.onTable = ['BLACK', 'CUE'].includes(ball.color); ball.potted = !ball.onTable;
    });
    const tied = c.rules.applyShot(initial, [
      { type: 'HIT', firstContact: 'BLACK' }, { type: 'POTTED', ball: 'BLACK', pocket: 'TL' }
    ], { decidingBlackDrawWinner: 'B' });
    assert.equal(tied.meta.decidingBlackChoice.winner, 'B');
    c.frameRef.current = tied; c.hudRef.current = buildSnookerViewerHud(tied, {}, 'B');
    const tableBefore = c.captureBallSnapshot();
    c.resolveRefereeChoice(choice);
    const next = c.frameRef.current;
    assert.equal(next.activePlayer, choice === 'play' ? 'B' : 'A');
    assert.equal(next.meta.decidingBlackChoice, undefined);
    assert.equal(next.meta.state.ballInHand, true);
    assert.equal(next.players.A.score, 17); assert.equal(next.players.B.score, 17);
    assert.equal(c.hudRef.current.turn, choice === 'play' ? 0 : 1);
    assert.deepEqual(c.captureBallSnapshot(), tableBefore, 'choosing the starter does not restore a foul layout');
    assert.equal(emitted.length, 1); assert.equal(emitted[0].payload.state.activePlayer, next.activePlayer);
  }
});
