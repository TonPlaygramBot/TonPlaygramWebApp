import { findSnookerRespotPosition, SNOOKER_RESPOT_ORDER } from '../webapp/src/games/snooker/respot';
import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
import { isSnookerObstructed } from '../webapp/src/utils/snookerVisibility.js';
import fs from 'node:fs';
import path from 'node:path';

const spots = { yellow: [-2, -7], green: [2, -7], brown: [0, -7], blue: [0, 0], pink: [0, 5], black: [0, 8] };
const options = { radius: 0.5, limitX: 5, limitY: 10 };
const at = (x: number, y: number) => ({ active: true, pos: { x, y } });

test('a colour uses its own spot, or the highest unoccupied colour spot', () => {
  expect(findSnookerRespotPosition('BLUE', spots, [], options)).toEqual({ x: 0, y: 0 });
  expect(findSnookerRespotPosition('BLUE', spots, [at(0, 0)], options)).toEqual({ x: 0, y: 8 });
  expect(findSnookerRespotPosition('BLUE', spots, [at(0, 0), at(0, 8)], options)).toEqual({ x: 0, y: 5 });
});

test('occupied spots use the nearest clear point along its own line toward black', () => {
  const balls = Object.values(spots).map(([x, y]) => at(x, y));
  balls.push(at(0.7, 1.5));
  const result = findSnookerRespotPosition('BLUE', spots, balls, options)!;
  expect(result.x).toBe(0);
  expect(result.y).toBeGreaterThan(2.22);
  expect(result.y).toBeLessThan(2.24);
  for (const ball of balls) expect(Math.hypot(result.x - ball.pos.x, result.y - ball.pos.y)).toBeGreaterThanOrEqual(1.01);
});

test('a blocked black can be respotted toward baulk without crossing the cushion', () => {
  const tightSpots = { ...spots, black: [0, 9.6] };
  const balls = Object.values(tightSpots).map(([x, y]) => at(x, y));
  const result = findSnookerRespotPosition('BLACK', tightSpots, balls, options)!;
  expect(result.x).toBe(0);
  expect(result.y).toBeLessThan(8.6);
  expect(result.y).toBeGreaterThan(8.58);
});

test('multiple foul colours are respotted highest first, respecting each new position', () => {
  const balls = [at(0, 8)];
  const positions: Record<string, { x: number; y: number }> = {};
  for (const colour of SNOOKER_RESPOT_ORDER.filter(colour => ['PINK', 'BLACK'].includes(colour))) {
    const result = findSnookerRespotPosition(colour, spots, balls, options)!;
    positions[colour] = result;
    balls.push(at(result.x, result.y));
  }
  expect(positions.BLACK).toEqual({ x: 0, y: 5 });
  expect(positions.PINK).toEqual({ x: 0, y: 0 });
});

test('inactive balls do not block respots; reserved spots and table geometry do', () => {
  expect(findSnookerRespotPosition('BLUE', spots, [{ ...at(0, 0), active: false }], options)).toEqual({ x: 0, y: 0 });
  expect(findSnookerRespotPosition('BLUE', spots, [], {
    ...options, reserved: [{ x: 0, y: 0 }], fits: point => point.y < 7
  })).toEqual({ x: 0, y: 5 });
  expect(findSnookerRespotPosition('BLUE', spots, [], { ...options, fits: () => false })).toBeNull();
});

test.each([false, true])('live deciding black respots after a tying foul or pot (pot=%s)', (pot) => {
  const rules = new SnookerRoyalRules();
  const currentState = rules.getInitialFrame('A', 'B');
  currentState.phase = 'COLORS_ORDER';
  currentState.redsRemaining = 0;
  currentState.ballOn = ['BLACK'];
  currentState.meta!.colorsRemaining = ['BLACK'];
  currentState.players.A.score = pot ? 0 : 7;
  currentState.players.B.score = pot ? 7 : 0;
  currentState.balls.forEach(ball => { ball.onTable = ['CUE', 'BLACK'].includes(ball.color); });
  const safeState = rules.applyShot(currentState, pot
    ? [{ type: 'HIT', firstContact: 'BLACK' }, { type: 'POTTED', ball: 'BLACK', pocket: 'TL' }]
    : [{ type: 'FOUL', reason: 'no contact' }]);
  const vector = (x = 0, y = 0) => ({ x, y, set(a: number, b: number) { this.x = a; this.y = b; } });
  const simBall = (active: boolean, x: number, y: number) => ({
    id: 'black', active, pos: vector(x, y), vel: vector(),
    mesh: { visible: true, scale: { set() {} }, position: { set() {} } },
    shadow: { visible: true, position: { set() {} } }
  });
  const black = simBall(!pot, 2, 3);
  const cue = { ...simBall(true, 0, 8), id: 'cue' };
  const balls = [cue, black];
  // Execute the production scene reconciliation, so state-only tests cannot
  // hide an active black left off its spot or a cue-in-hand blocking the spot.
  const source = fs.readFileSync(path.resolve('webapp/src/pages/Games/SnookerRoyal.jsx'), 'utf8');
  const start = source.indexOf('            // A cue ball in hand cannot obstruct a colour spot.');
  const end = source.indexOf('            if (isTraining)', start);
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  const environment = {
    rules, isSnookerObstructed, BALL_R: options.radius,
    safeState, currentState, cue, colors: { black }, balls, ballsRef: { current: balls },
    snookerSpotsRef: { current: spots }, SPOTS: spots, SNOOKER_RESPOT_ORDER,
    BALL_CENTER_Y: 0.5, BALL_SHADOW_Y: 0, pocketDropRef: { current: new Set(['black']) },
    deriveInHandFromFrame: () => Boolean((safeState.meta!.state as { ballInHand: boolean }).ballInHand),
    resolveSnookerRespotPosition: (colour: 'BLACK', map: typeof spots, sim: typeof balls) => {
      const point = findSnookerRespotPosition(colour, map, sim, options);
      return point && { x: point.x, z: point.y };
    }
  };
  new Function(...Object.keys(environment), source.slice(start, end))(...Object.values(environment));
  expect(cue.active).toBe(false);
  expect(black.active).toBe(true);
  expect(black.pos).toMatchObject({ x: 0, y: 8 });
});
