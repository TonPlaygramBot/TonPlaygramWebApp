import * as THREE from '../webapp/node_modules/three/build/three.cjs';
import { isPoolRoyalBreak, poolRoyalBallInHand, poolRoyalBallNumber, recordPoolRoyalRail, findPoolRoyalSpot } from '../webapp/src/pages/Games/poolRoyaleShotLifecycle.js';
import { resolvePoolRoyalReleasePower } from '../webapp/src/pages/Games/poolRoyaleShotState.js';
import { advancePoolRoyalCueStroke, resolveCueBallContact, referenceCuePull } from '../webapp/src/pages/Games/poolRoyaleCueStrokeTimeline.js';
import { BcaEightBall } from '../lib/bcaEightBall.js';
import { NineBall } from '../lib/nineBall.js';
import { UkPool } from '../lib/poolUk8Ball.js';

it('committed release wins over stale power, and zero/repeated releases cannot fire', () => {
  expect(resolvePoolRoyalReleasePower({ committedPower: 0.2, currentPower: 1 })).toBe(0.2);
  expect(resolvePoolRoyalReleasePower({ committedPower: 0, currentPower: 1 })).toBeNull();
  expect(resolvePoolRoyalReleasePower({ currentPower: 0.7 })).toBe(0.7);
  expect(resolvePoolRoyalReleasePower({ busy: true, committedPower: 1 })).toBeNull();
});

it('a new scoring run does not trigger break power or override turn rules', () => {
  expect(isPoolRoyalBreak({ currentBreak: 0, meta: { variant: '8ball', state: { breakInProgress: false } } })).toBe(false);
  expect(isPoolRoyalBreak({ meta: { variant: '9ball', state: { breakInProgress: true } } })).toBe(true);
  expect(isPoolRoyalBreak({ meta: { variant: 'uk', state: { lastEvent: 'BREAK_START' } } })).toBe(true);
  expect(isPoolRoyalBreak({ currentBreak: 0, meta: { variant: 'uk', state: { lastEvent: 'FOUL' } } })).toBe(false);
});

it('break legality counts four different object balls; cue and repeated bounces do not qualify', () => {
  const context = { contactMade: true };
  for (const id of ['cue', 'ball_1', 'ball_1', 'ball_1']) recordPoolRoyalRail(context, id);
  expect(context.railContactCountAfterContact).toBe(4);
  expect(context.objectBallsToRailAfterContact).toEqual(['1']);
  expect(poolRoyalBallNumber('ball_9')).toBe(9);
  expect(poolRoyalBallNumber('cue')).toBeNull();
  for (const Game of [BcaEightBall, NineBall]) {
    const illegal = new Game().shotTaken({ contactOrder: [1], potted: [], ...context });
    expect(illegal.reason).toBe('illegal break');
    expect(new Game().shotTaken({ contactOrder: [1], potted: [], objectBallsToRailAfterContact: ['1','2','3','4'] }).foul).toBe(false);
  }
});

it('eight-ball stays open on the break and spots the eight, including a scratch', () => {
  const game = new BcaEightBall();
  expect(game.shotTaken({ contactOrder: [1], potted: [1] }).foul).toBe(false);
  expect(game.state.assignments).toEqual({ A: null, B: null });
  expect(game.state.currentPlayer).toBe('A');
  game.shotTaken({ contactOrder: [2], potted: [2] });
  expect(game.state.assignments.A).toBe('SOLID');
  for (const potted of [[8], [8, 0]]) {
    const rack = new BcaEightBall();
    const result = rack.shotTaken({ contactOrder: [1], potted });
    expect(result.frameOver).toBe(false);
    expect(rack.state.ballsOnTable.has(8)).toBe(true);
    expect(rack.state.ballInHand).toBe(potted.includes(0));
  }
});

it('a legal own-ball plus opponent-ball pot keeps the US inning, and an opponent-only pot passes it', () => {
  const game = new BcaEightBall();
  Object.assign(game.state, { breakInProgress: false, assignments: { A: 'SOLID', B: 'STRIPE' } });
  expect(game.shotTaken({ contactOrder: [1], potted: [1, 9] }).nextPlayer).toBe('A');
  const result = game.shotTaken({ contactOrder: [2], potted: [10] });
  expect(result.foul).toBe(false); expect(result.nextPlayer).toBe('B');
});

it('nine-ball foul streak survives the opponent’s legal turns and loses on the third own foul', () => {
  const game = new NineBall(); game.state.breakInProgress = false;
  const foul = () => game.shotTaken({ contactOrder: [2], potted: [] });
  const miss = () => game.shotTaken({ contactOrder: [1], potted: [] });
  foul(); miss(); expect(game.state.foulStreak.A).toBe(1);
  foul(); miss(); expect(game.state.foulStreak.A).toBe(2);
  const loss = foul(); expect(loss.frameOver).toBe(true); expect(loss.winner).toBe('B');
  const reset = new NineBall(); reset.state.breakInProgress = false;
  reset.shotTaken({ contactOrder: [2] }); reset.shotTaken({ contactOrder: [1] });
  reset.shotTaken({ contactOrder: [1], potted: [1] });
  expect(reset.state.foulStreak.A).toBe(0);
});

it('UK foul pots stay down and full-table ball-in-hand survives the frame adapter', () => {
  const game = new UkPool(); game.state.lastEvent = 'SHOT_TAKEN';
  const result = game.shotTaken({ contactOrder: ['red'], potted: ['red', 'cue'] });
  expect(result.foul).toBe(true); expect(game.state.ballsOnTable.red.size).toBe(6);
  expect(poolRoyalBallInHand({ meta: { variant: 'uk', state: game.state } })).toBe(true);
  expect(poolRoyalBallInHand({ frameOver: true, meta: { state: game.state } })).toBe(false);
});

it('the nine spots on the foot string without overlapping a ball or moving existing balls', () => {
  const balls = [{ id: 1, active: true, pos: new THREE.Vector2(0, -5) },
    { id: 2, active: true, pos: new THREE.Vector2(0, -7.01) }, { id: 9, active: false, pos: new THREE.Vector2(9, 9) }];
  const before = balls.map(ball => ball.pos.toArray());
  const spot = findPoolRoyalSpot(balls, 9, { x: 0, y: -5, minY: -10, maxY: 10, radius: 1 });
  expect(spot.y).toBeLessThan(-9); expect(spot.x).toBe(0);
  expect(balls.map(ball => ball.pos.toArray())).toEqual(before);
});

it('the rounded cue cap contacts the cue ball through tilt and spin, and launches exactly once after rendering contact', () => {
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const power of [0.02, 0.5, 1]) {
    const direction = new THREE.Vector3(Math.sin(yaw), -0.08, Math.cos(yaw)).normalize();
    const ball = new THREE.Vector3(0, 1, 0);
    const contact = resolveCueBallContact(ball, direction, new THREE.Vector3(0.35, -0.3, 0.15), 1, 0.16);
    const capCentre = contact.clone().addScaledVector(direction, -0.16);
    expect(capCentre.distanceTo(ball)).toBeCloseTo(1.16, 9);
    const cue = { position: contact.clone().addScaledVector(direction, -referenceCuePull(power, 1)), visible: true };
    let hits = 0;
    const stroke = { startTime: 0, pullPos: cue.position.clone(), contactPos: contact,
      onImpact: () => { expect(cue.position.distanceTo(contact)).toBeLessThan(1e-9); hits++; } };
    let previousDistance = Infinity;
    for (const now of [0, 16, 40, 75, 90, 106, 135, 300, 900]) {
      advancePoolRoyalCueStroke(cue, stroke, now);
      const distance = cue.position.distanceTo(contact);
      expect(distance).toBeLessThanOrEqual(previousDistance + 1e-9); previousDistance = distance;
    }
    expect(hits).toBe(1); expect(cue.visible).toBe(false);
    const skipped = { ...stroke, shotApplied: false, onImpact: () => hits++ };
    advancePoolRoyalCueStroke(cue, skipped, 500);
    expect(hits).toBe(2);
    expect(cue.visible).toBe(true);
    advancePoolRoyalCueStroke(cue, skipped, 551);
    expect(cue.visible).toBe(false); expect(hits).toBe(2);
  }
});
