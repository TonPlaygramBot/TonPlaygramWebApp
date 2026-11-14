import fs from 'node:fs';
import path from 'node:path';
import { PoolRoyaleRules } from '../src/rules/PoolRoyaleRules';
import { findPoolRoyalSpot, poolRoyalBallInHand, poolRoyalBallsToSpot } from '../webapp/src/pages/Games/poolRoyaleShotLifecycle';

test.each([1, -1])('blocked respots search toward the physical foot rail (direction %s)', direction => {
  const balls = [{ id: 'ball_1', active: true, pos: { x: 0, y: 5 * direction } }];
  const result = findPoolRoyalSpot(balls, 'ball_9', {
    x: 0, y: 5 * direction, minY: -10, maxY: 10, radius: 1
  })!;
  expect(result.x).toBe(0);
  expect(result.y * direction).toBeGreaterThan(7);
  expect(result.y * direction).toBeLessThan(7.02);
});

test('a full foot side falls back toward the head and never overlaps the blocking ball', () => {
  const balls = [{ id: 'ball_1', active: true, pos: { x: 0, y: 9.5 } }];
  const result = findPoolRoyalSpot(balls, 'ball_9', {
    x: 0, y: 9.5, minY: -10, maxY: 10, radius: 1
  })!;
  expect(result.y).toBeCloseTo(7.49, 4);
  expect(Math.abs(result.y - 9.5)).toBeGreaterThanOrEqual(2.01);
});

test.each(['8ball', '9ball'])('live %s respots its special ball after lifting the cue in hand', variant => {
  const rules = new PoolRoyaleRules(variant, 'reference');
  const state = rules.getInitialFrame('A', 'B');
  const number = variant === '8ball' ? 8 : 9;
  const safeState = rules.applyShot(state, [
    { type: 'HIT', firstContact: variant === '8ball' ? 'BALL_1' : 'BALL_2', ballId: variant === '8ball' ? 'ball_1' : 'ball_2' },
    { type: 'POTTED', ball: `BALL_${number}`, ballId: `ball_${number}`, pocket: 'TL' }
  ], { contactMade: true });
  expect(safeState.frameOver).toBe(false);
  expect(poolRoyalBallInHand(safeState)).toBe(true);
  const vector = (x = 0, y = 0) => ({ x, y, set(a: number, b: number) { this.x = a; this.y = b; } });
  const mesh = () => ({ visible: false, scale: { set() {} }, position: { set() {} } });
  const object = { id: `ball_${number}`, active: false, pos: vector(9, 9), vel: vector(), mesh: mesh(), shadow: mesh() };
  const cue = { id: 'cue', active: true, pos: vector(0, 5), vel: vector(), mesh: mesh() };
  const balls = [cue, object];
  const source = fs.readFileSync(path.resolve('webapp/src/pages/Games/PoolRoyale.jsx'), 'utf8');
  const start = source.indexOf('            const cueNeedsPlacement = isTraining ? cueBallPotted : poolRoyalBallInHand(safeState);');
  const end = source.indexOf('            const colourNames', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const environment = {
    isTraining: false, cueBallPotted: false, safeState, balls, cue, frameRef: { current: state },
    poolRoyalBallInHand, poolRoyalBallsToSpot, findPoolRoyalSpot,
    SPOTS: { penalty: [0, 5] }, RAIL_LIMIT_Y: 10, BALL_R: 1,
    BALL_CENTER_Y: 1, BALL_SHADOW_Y: 0, removePocketDropEntry: () => {}
  };
  new Function(...Object.keys(environment), source.slice(start, end))(...Object.values(environment));
  expect(cue.active).toBe(false);
  expect(object.active).toBe(true);
  expect(object.pos).toMatchObject({ x: 0, y: 5 });
  expect(object.mesh.visible).toBe(true);
  expect(object.shadow.visible).toBe(true);
});

const liveSource = fs.readFileSync(path.resolve('webapp/src/pages/Games/PoolRoyale.jsx'), 'utf8');
function liveBlock(startText: string, endText: string) {
  const start = liveSource.indexOf(startText);
  const end = liveSource.indexOf(endText, start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return liveSource.slice(start, end);
}

class TestVector {
  constructor(public x = 0, public y = 0, public z = 0) {}
  set(x: number, y: number, z = 0) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new TestVector(this.x, this.y, this.z); }
  distanceTo(other: TestVector) { return Math.hypot(this.x - other.x, this.y - other.y); }
}
function liveBall(id: string, active: boolean, x: number, y: number) {
  const mesh = () => ({ visible: active, scale: new TestVector(1, 1, 1), position: new TestVector(x, 1, y), quaternion: { set() {} } });
  return { id, active, pos: new TestVector(x, y), vel: new TestVector(2, 3), spin: new TestVector(1, 2),
    pendingSpin: new TestVector(2, 1), omega: new TestVector(1, 2, 3), mesh: mesh(), shadow: mesh() };
}

function resolveLiveLayout(state: ReturnType<PoolRoyaleRules['getInitialFrame']>, safeState: ReturnType<PoolRoyaleRules['getInitialFrame']>,
  balls: ReturnType<typeof liveBall>[], initialLayout: unknown[] = []): Record<string, any> {
  const cue = balls.find(ball => ball.id === 'cue')!;
  const frameRef = { current: state };
  const pocketDropRef = { current: new Map(balls.filter(ball => !ball.active).map(ball => [ball.id, {}])) };
  const environment: Record<string, any> = {
    balls, cue, safeState, frameRef, frameState: state, isTraining: false, cueBallPotted: true,
    poolRoyalBallInHand, poolRoyalBallsToSpot, findPoolRoyalSpot,
    SPOTS: { penalty: [0, 5] }, RAIL_LIMIT_Y: 19, BALL_R: 1,
    BALL_CENTER_Y: 1, BALL_SHADOW_Y: 0, PLAY_W: 40, PLAY_H: 40, baulkZ: -5,
    activeVariantRef: { current: { id: safeState.meta?.variant } }, variantKey: safeState.meta?.variant,
    CUSHION_SEGMENTS: [], colors: {}, THREE: { Vector2: TestVector, MathUtils: { clamp: (n: number, a: number, b: number) => Math.min(b, Math.max(a, n)) } },
    findClearPoolBallPosition: require('../webapp/src/pages/Games/poolRoyaleBallSeparation.js').findClearPoolBallPosition,
    inHandDragRef: { current: {} }, cueStickAnchorRef: { current: new TestVector() }, CUE_Y: 1,
    cueBallPlacedFromHandRef: { current: true }, pendingInHandResetRef: { current: false },
    initialLayoutRef: { current: initialLayout }, pocketDropRef, pocketRestIndexRef: { current: new Map([['TM', 2]]) },
    pocketPopupRef: { current: [{ id: 'old' }] }, pocketPopupPendingRef: { current: [{ id: 'old' }] },
    pocketLightingRef: { current: { clear: jest.fn() } }, setPottedBySeat: jest.fn(),
    lastPottedBySeatRef: { current: { A: 'old', B: 'old' } }, lastAssignmentsRef: { current: { A: 'red', B: 'blue' } },
    showRuleToast: jest.fn(), removePocketDropEntry: (id: string) => pocketDropRef.current.delete(id),
    normalizeVector3Snapshot: (value: unknown) => value, normalizeQuaternionSnapshot: (value: unknown) => value
  };
  const snapshotCode = liveBlock('        const applyBallSnapshot = (snapshot) => {', '        captureBallSnapshotRef.current = captureBallSnapshot;');
  environment.applyBallSnapshotRef = { current: new Function(...Object.keys(environment), `${snapshotCode}; return applyBallSnapshot;`)(...Object.values(environment)) };
  const placementCode = liveBlock('      const allowFullTableInHand = () => {', '      const tryUpdatePlacement = (raw, commit = false) => {');
  const placement = new Function(...Object.keys(environment), `${placementCode}; return { respawnCueBallForInHand, allowFullTableInHand, clampInHandPosition };`)(...Object.values(environment));
  Object.assign(environment, placement);
  const resolveCode = liveBlock('            const cueNeedsPlacement = isTraining ? cueBallPotted : poolRoyalBallInHand(safeState);', '            if (shouldStartReplay) {');
  new Function(...Object.keys(environment), resolveCode)(...Object.values(environment));
  return { ...environment, placement };
}

test('live UK black-on-break restores the complete physical rack and restricts the next break to baulk', () => {
  const rules = new PoolRoyaleRules('uk');
  const state = rules.getInitialFrame('Human', 'AI');
  state.activePlayer = 'B';
  const safeState = rules.applyShot(state, [
    { type: 'HIT', firstContact: 'red', ballId: 'red_1' },
    { type: 'POTTED', ball: 'red', ballId: 'red_1', pocket: 'TM' },
    { type: 'POTTED', ball: 'black', ballId: 'black_8', pocket: 'TM' },
    { type: 'POTTED', ball: 'cue', ballId: 'cue', pocket: 'TM' }
  ], { placedFromHand: true, cueBallPotted: true });
  const ids = [...Array.from({ length: 7 }, (_, index) => `red_${index + 1}`),
    ...Array.from({ length: 7 }, (_, index) => `yellow_${index + 1}`), 'black_8'];
  const balls = [liveBall('cue', false, 18, 18), ...ids.map((id, index) => liveBall(id, !['red_1', 'black_8'].includes(id), 16, index))];
  const initialLayout = balls.map((ball, index) => ({ id: ball.id, active: true,
    pos: { x: index === 0 ? 0 : (index % 5) * 3 - 6, y: index === 0 ? -8 : 4 + Math.floor(index / 5) * 3 },
    mesh: { position: { x: index === 0 ? 0 : (index % 5) * 3 - 6, y: 1, z: index === 0 ? -8 : 4 + Math.floor(index / 5) * 3 }, scale: { x: 1, y: 1, z: 1 }, visible: true }
  }));
  const env = resolveLiveLayout(state, safeState, balls, initialLayout);
  expect(safeState.activePlayer).toBe('B');
  expect(safeState.frameOver).toBe(false);
  expect(balls.every(ball => ball.active)).toBe(true);
  for (const ball of balls.slice(1)) {
    const expected = initialLayout.find(entry => entry.id === ball.id)!;
    expect(ball.pos).toMatchObject(expected.pos);
    expect(ball.mesh.visible).toBe(true);
    expect(ball.shadow.visible).toBe(true);
    expect(ball.vel).toMatchObject({ x: 0, y: 0 });
  }
  expect(env.frameRef.current).toBe(safeState);
  expect(env.placement.allowFullTableInHand()).toBe(false);
  expect(balls[0].pos.y).toBeLessThanOrEqual(-5);
  expect(env.placement.clampInHandPosition(new TestVector(0, 12)).y).toBe(-5);
  expect(env.pendingInHandResetRef.current).toBe(true);
  expect(env.pocketDropRef.current.size).toBe(0);
  expect(env.setPottedBySeat).toHaveBeenCalledWith({ A: [], B: [] });
  expect(env.lastAssignmentsRef.current).toEqual({ A: null, B: null });
  expect(env.pocketRestIndexRef.current.size).toBe(0);
});

test('live 61 scratch restores every foul pot without overlap and places the cue behind the head string', () => {
  const rules = new PoolRoyaleRules('61points');
  // Deliberately start from an unrestricted pre-shot state. Placement must use
  // the newly resolved foul frame rather than this previous frame.
  const state = rules.getInitialFrame('Human', 'AI');
  (state.meta as any).state.breakInProgress = false;
  (state.meta as any).breakInProgress = false;
  (state.meta as any).state.mustPlayFromBaulk = false;
  (state.meta as any).state.ballInHand = false;
  const safeState = rules.applyShot(state, [
    { type: 'HIT', firstContact: 1, ballId: 'ball_1' },
    { type: 'POTTED', ball: 8, ballId: 'ball_8', pocket: 'TM' },
    { type: 'POTTED', ball: 15, ballId: 'ball_15', pocket: 'TM' },
    { type: 'POTTED', ball: 'cue', ballId: 'cue', pocket: 'TM' }
  ], { cueBallPotted: true });
  const balls = [liveBall('cue', false, 0, 5), liveBall('ball_1', true, 0, 5), liveBall('ball_8', false, 17, 17), liveBall('ball_15', false, 18, 18)];
  const env = resolveLiveLayout(state, safeState, balls);
  expect(safeState.players.A.score).toBe(0);
  expect(safeState.players.B.score).toBe(0);
  expect(safeState.activePlayer).toBe('B');
  expect(balls.every(ball => ball.active)).toBe(true);
  for (const ball of balls.slice(2)) {
    expect(ball.mesh.visible).toBe(true);
    expect(ball.shadow.visible).toBe(true);
    expect(ball.vel).toMatchObject({ x: 0, y: 0 });
    expect(ball.pos.x).toBe(0);
  }
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) expect(balls[i].pos.distanceTo(balls[j].pos)).toBeGreaterThanOrEqual(2.01);
  }
  expect(balls[0].pos.y).toBeLessThanOrEqual(-5);
  expect(env.placement.allowFullTableInHand()).toBe(false);
  expect(env.placement.clampInHandPosition(new TestVector(0, 12)).y).toBe(-5);
  expect(env.pendingInHandResetRef.current).toBe(true);
  expect(env.pocketDropRef.current.size).toBe(0);
});
