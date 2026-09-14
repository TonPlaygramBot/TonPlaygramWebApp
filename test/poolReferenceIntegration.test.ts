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
  const rules = new PoolRoyaleRules(variant);
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
    isTraining: false, cueBallPotted: false, safeState, balls, cue,
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
