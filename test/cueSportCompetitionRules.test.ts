import { PoolRoyaleRules } from '../src/rules/PoolRoyaleRules';
import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
import { BcaEightBall } from '../lib/bcaEightBall.js';
import { NineBall } from '../lib/nineBall.js';
import { ShotEvent } from '../src/types';

const hit = (ballId: string | number): ShotEvent => ({ type: 'HIT', firstContact: ballId, ballId });
const pot = (ballId: string | number, pocket: 'TL' | 'TR' = 'TL'): ShotEvent =>
  ({ type: 'POTTED', ball: ballId, ballId, pocket });

describe('competition eight-ball', () => {
  test('the live default keeps the table open after a successful break', () => {
    const rules = new PoolRoyaleRules('8ball');
    const state = rules.applyShot(rules.getInitialFrame('A', 'B'), [hit(1), pot(1)]);
    expect(state.meta).toMatchObject({ ruleProfile: 'standard', state: { assignments: { A: null, B: null } } });
    expect(state.ballOn).toEqual(['SOLID', 'STRIPE']);
    expect(state.activePlayer).toBe('A');
  });

  test('called ball selects the group even if both groups fall', () => {
    const rules = new PoolRoyaleRules('8ball');
    const state = rules.getInitialFrame('A', 'B');
    (state.meta as any).state.breakInProgress = false;
    const next = rules.applyShot(state, [hit(1), pot(1), pot(9, 'TR')], { calledBallId: 9, calledPocket: 'TR' });
    expect(next.foul).toBeUndefined();
    expect(next.meta).toMatchObject({ state: { assignments: { A: 'STRIPE', B: 'SOLID' } } });
    expect(next.activePlayer).toBe('A');
  });

  test('a missed called pocket passes play without ball in hand or a group assignment', () => {
    const rules = new PoolRoyaleRules('8ball');
    const state = rules.getInitialFrame('A', 'B');
    (state.meta as any).state.breakInProgress = false;
    const next = rules.applyShot(state, [hit(1), pot(1)], { calledBallId: 1, calledPocket: 'TR' });
    expect(next.activePlayer).toBe('B');
    expect(next.foul).toBeUndefined();
    expect(next.meta).toMatchObject({ state: { ballInHand: false, assignments: { A: null, B: null } } });
    expect((next.meta as any).state.ballsOnTable).not.toContain(1);
  });

  test('a declared safety passes play even when the own-group ball falls', () => {
    const game = new BcaEightBall();
    game.state.breakInProgress = false;
    game.state.assignments = { A: 'SOLID', B: 'STRIPE' };
    expect(game.shotTaken({ contactOrder: [1], potted: [1], safety: true }))
      .toMatchObject({ legal: true, nextPlayer: 'B', ballInHandNext: false });
  });

  test('the final eight in an uncalled pocket loses the rack', () => {
    const game = new BcaEightBall();
    game.state.breakInProgress = false;
    game.state.assignments = { A: 'SOLID', B: 'STRIPE' };
    game.state.ballsOnTable = new Set([8, 9]);
    expect(game.shotTaken({ contactOrder: [8], potted: [8], calledBallId: 8,
      calledPocket: 'TR', pottedPockets: { 8: 'TL' } }))
      .toMatchObject({ frameOver: true, winner: 'B', reason: 'black in uncalled pocket' });
  });

  test('the eight can be struck first on the break and is respotted if potted', () => {
    const game = new BcaEightBall();
    expect(game.shotTaken({ contactOrder: [8], potted: [8] }))
      .toMatchObject({ legal: true, frameOver: false, nextPlayer: 'A' });
    expect(game.state.ballsOnTable.has(8)).toBe(true);
  });

  test('a break scratch limits the next placement to baulk, normal fouls do not', () => {
    const game = new BcaEightBall();
    game.shotTaken({ contactOrder: [1], potted: [0] });
    expect(game.state.mustPlayFromBaulk).toBe(true);
    game.shotTaken({ contactOrder: [1], potted: [0] });
    expect(game.state.mustPlayFromBaulk).toBe(false);
  });

  test('driving the eight off the table loses except on the break', () => {
    const game = new BcaEightBall();
    expect(game.shotTaken({ contactOrder: [1], offTable: [8] }).frameOver).toBe(false);
    expect(game.state.ballsOnTable.has(8)).toBe(true);
    expect(game.shotTaken({ contactOrder: [1], offTable: [8] }))
      .toMatchObject({ frameOver: true, winner: 'A' });
  });

  test('an open table permits claiming an already-cleared group for the eight', () => {
    const game = new BcaEightBall();
    game.state.breakInProgress = false;
    game.state.ballsOnTable = new Set([8, 9, 10]);
    expect(game.shotTaken({ contactOrder: [8], potted: [8], calledBallId: 8,
      calledPocket: 'TL', pottedPockets: { 8: 'TL' } }))
      .toMatchObject({ legal: true, frameOver: true, winner: 'A' });
  });
});

describe('competition nine-ball push out', () => {
  test('only the shot immediately after a legal break offers a push out', () => {
    const game = new NineBall();
    game.shotTaken({ contactOrder: [1], potted: [1] });
    expect(game.state.pushOutAvailable).toBe(true);
    game.shotTaken({ contactOrder: [2], noCushionAfterContact: false });
    expect(game.state.pushOutAvailable).toBe(false);
  });

  test('push out suspends contact/rail rules, spots nine, keeps other balls down', () => {
    const game = new NineBall();
    game.shotTaken({ contactOrder: [1], potted: [1] });
    expect(game.shotTaken({ pushOut: true, contactOrder: [], potted: [2, 9], noCushionAfterContact: true }))
      .toMatchObject({ legal: true, frameOver: false, nextPlayer: 'B', ballInHandNext: false });
    expect(game.state.ballsOnTable.has(9)).toBe(true);
    expect(game.state.ballsOnTable.has(2)).toBe(false);
    expect(game.state.pushOutPending).toEqual({ shooter: 'A', chooser: 'B' });
    expect(game.shotTaken({ contactOrder: [3] }).reason).toBe('push-out decision required');
    expect(game.resolvePushOut('return')).toBe(true);
    expect(game.state.currentPlayer).toBe('A');
    expect(game.state.pushOutPending).toBeNull();
  });

  test('a scratch on push out remains a foul and cancels the return choice', () => {
    const game = new NineBall();
    game.shotTaken({ contactOrder: [1], potted: [1] });
    expect(game.shotTaken({ pushOut: true, potted: [0, 9] }))
      .toMatchObject({ foul: true, reason: 'scratch', ballInHandNext: true });
    expect(game.state.pushOutPending).toBeNull();
    expect(game.state.ballsOnTable.has(9)).toBe(true);
  });

  test('push-out choice survives JSON storage and blocks stale shot notifications', () => {
    const rules = new PoolRoyaleRules('9ball');
    const broken = rules.applyShot(rules.getInitialFrame('A', 'B'), [hit(1), pot(1)]);
    const pushed = rules.applyShot(broken, [], { pushOut: true, contactMade: false, noCushionAfterContact: true });
    const saved = JSON.parse(JSON.stringify(pushed));
    expect(rules.applyShot(saved, [hit(2), pot(9)])).toBe(saved);
    const returned = new PoolRoyaleRules('9ball').resolvePushOut(saved, 'return');
    expect(returned.activePlayer).toBe('A');
    expect(returned.meta).toMatchObject({ state: { pushOutPending: null, ballInHand: false } });
    expect(saved.activePlayer).toBe('B');
  });

  test('off-table object balls foul and stay down except the nine', () => {
    const game = new NineBall();
    game.state.breakInProgress = false;
    expect(game.shotTaken({ contactOrder: [1], offTable: [3, 9] }))
      .toMatchObject({ foul: true, frameOver: false, ballInHandNext: true });
    expect(game.state.ballsOnTable.has(9)).toBe(true);
    expect(game.state.ballsOnTable.has(3)).toBe(false);
  });

  test.each([BcaEightBall, NineBall])('a cue off-table event gives ball in hand in %s', Game => {
    const game = new Game();
    expect(game.shotTaken({ contactOrder: [1], offTable: ['cue'] }))
      .toMatchObject({ foul: true, reason: 'scratch', ballInHandNext: true });
  });
});

describe('snooker referee decisions', () => {
  const rules = new SnookerRoyalRules();
  test('a foul before nominating a post-red colour costs seven in standard mode', () => {
    const red = rules.applyShot(rules.getInitialFrame('A', 'B'), [hit('RED_1'), pot('RED_1')]);
    expect(rules.applyShot(red, [], { contactMade: false }).foul?.points).toBe(7);
    expect(rules.applyShot(red, [], { contactMade: false, declaredBall: 'YELLOW' }).foul?.points).toBe(4);
  });

  test('requiring a replay preserves penalties and restores the offender’s colour nomination', () => {
    const red = rules.applyShot(rules.getInitialFrame('A', 'B'), [hit('RED_1'), pot('RED_1')]);
    const foul = rules.applyShot(red, [hit('BLUE')], { declaredBall: 'BLACK' });
    const serialized = JSON.parse(JSON.stringify(foul));
    const returned = rules.resolveFoulChoice(serialized, 'return');
    expect(returned.activePlayer).toBe('A');
    expect(returned.colorOnAfterRed).toBe(true);
    expect(returned.ballOn).toContain('BLACK');
    expect(returned.players.B.score).toBe(7);
    expect(returned.currentBreak).toBe(0);
    expect(returned.freeBall).toBe(false);
    expect(returned.balls).toEqual(foul.balls);
    expect((returned.meta as any).foulChoice).toBeUndefined();
    expect(serialized.activePlayer).toBe('B');
  });

  test('the return option expires once the incoming player has taken a stroke', () => {
    const foul = rules.applyShot(rules.getInitialFrame('A', 'B'), [hit('BLACK')]);
    const played = rules.applyShot(foul, [hit('RED_1')]);
    expect((played.meta as any).foulChoice).toBeUndefined();
    expect(rules.resolveFoulChoice(played, 'return')).toBe(played);
  });

  test('settled post-respot geometry can grant a free ball without scoring twice', () => {
    const foul = rules.applyShot(rules.getInitialFrame('A', 'B'), [hit('BLACK')]);
    const snookered = rules.setSnookeredAfterFoul(foul, true);
    expect(snookered.freeBall).toBe(true);
    expect((snookered.meta as any).hud.next).toContain('free ball');
    expect(snookered.players).toEqual(foul.players);
    expect(foul.freeBall).toBe(false);
    expect(rules.resolveFoulChoice(snookered, 'return').freeBall).toBe(false);
  });
});
