import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
import { BallColor, FrameState, ShotEvent } from '../src/types';

const rules = new SnookerRoyalRules(undefined, 'reference');
const colors: BallColor[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];
const hit = (firstContact: string): ShotEvent => ({ type: 'HIT', firstContact });
const pot = (ball: string, ballId?: string): ShotEvent => ({ type: 'POTTED', ball, ballId, pocket: 'TL' });
const fresh = () => rules.getInitialFrame('Player', 'Opponent');
const afterRed = () => rules.applyShot(fresh(), [hit('RED'), pot('RED', 'red_1')]);
function clearance(target: BallColor = 'YELLOW'): FrameState {
  const state = fresh();
  const remaining = colors.slice(colors.indexOf(target));
  state.phase = 'COLORS_ORDER';
  state.redsRemaining = 0;
  state.ballOn = [target];
  state.meta!.colorsRemaining = remaining;
  state.balls.forEach(ball => {
    ball.onTable = ball.color === 'CUE' || remaining.includes(ball.color);
    ball.potted = !ball.onTable;
  });
  return state;
}

describe('Snooker reference gameplay', () => {
  test('starts with fifteen reds, six colours and cue placement in the D', () => {
    const state = fresh();
    expect(state.balls).toHaveLength(22);
    expect(state.ballOn).toEqual(['RED']);
    expect(state.meta).toMatchObject({ state: { ballInHand: true } });
  });

  test('an ordinary safety changes turn without requiring a cushion', () => {
    const state = fresh();
    const next = rules.applyShot(state, [hit('RED')], { noCushionAfterContact: true });
    expect(next.foul).toBeUndefined();
    expect(next.activePlayer).toBe('B');
    expect(next.players.B.score).toBe(0);
  });

  test('scores multiple distinct reds and returns the following colour to its spot', () => {
    const next = rules.applyShot(fresh(), [hit('RED'), pot('RED', 'red_3'), pot('RED', 'red_8')]);
    expect(next.currentBreak).toBe(2);
    expect(next.redsRemaining).toBe(13);
    expect(next.activePlayer).toBe('A');
    expect(next.colorOnAfterRed).toBe(true);
    const colour = rules.applyShot(next, [hit('BLACK'), pot('BLACK', 'black')]);
    expect(colour.players.A.score).toBe(9);
    expect(colour.ballOn).toEqual(['RED']);
    expect(colour.balls.find(ball => ball.id === 'BLACK')!.onTable).toBe(true);
  });

  test('the last red earns one respotted colour before ordered clearance', () => {
    const state = fresh();
    state.redsRemaining = 1;
    state.balls.filter(ball => ball.color === 'RED' && ball.id !== 'RED_1').forEach(ball => {
      ball.onTable = false;
      ball.potted = true;
    });
    const red = rules.applyShot(state, [hit('RED'), pot('RED', 'red_1')]);
    expect(red.redsRemaining).toBe(0);
    expect(red.colorOnAfterRed).toBe(true);
    const black = rules.applyShot(red, [hit('BLACK'), pot('BLACK')]);
    expect(black.phase).toBe('COLORS_ORDER');
    expect(black.ballOn).toEqual(['YELLOW']);
    expect(black.players.A.score).toBe(8);
    expect(black.balls.find(ball => ball.id === 'BLACK')!.onTable).toBe(true);
  });

  test('an undeclared colour must be the first colour contacted', () => {
    const next = rules.applyShot(afterRed(), [hit('PINK'), pot('YELLOW')]);
    expect(next.foul).toMatchObject({ points: 6 });
    expect(next.players.A.score).toBe(1);
    expect(next.players.B.score).toBe(6);
    expect(next.balls.find(ball => ball.id === 'YELLOW')!.onTable).toBe(true);
  });

  test('a declaration constrains first contact even on a safety', () => {
    const next = rules.applyShot(afterRed(), [hit('YELLOW')], { declaredBall: 'BLACK' });
    expect(next.foul).toMatchObject({ points: 7, reason: 'wrong ball' });
    expect(next.activePlayer).toBe('B');
  });

  test.each(['RED', 'CUE', 'unknown'])('rejects %s as a post-red colour declaration', declaredBall => {
    const next = rules.applyShot(afterRed(), [hit('BLACK'), pot('BLACK')], { declaredBall });
    expect(next.foul?.reason).toBe('invalid nomination');
    expect(next.players.A.score).toBe(1);
  });

  test('an undeclared no-contact miss after red uses the reference four-point minimum', () => {
    const next = rules.applyShot(afterRed(), [], { contactMade: false });
    expect(next.foul).toEqual({ points: 4, reason: 'no contact' });
    expect(next.ballOn).toEqual(['RED']);
  });

  test('no contact with a declared black incurs seven points', () => {
    const next = rules.applyShot(afterRed(), [], { declaredBall: 'BLACK', contactMade: false });
    expect(next.foul?.points).toBe(7);
  });

  test('no contact at the start of clearance uses the current colour value', () => {
    expect(rules.applyShot(clearance('BLUE'), []).foul?.points).toBe(5);
    expect(rules.applyShot(clearance('PINK'), []).foul?.points).toBe(6);
  });

  test('a foul pots no scoring points, leaves reds down and restores colours', () => {
    const next = rules.applyShot(fresh(), [hit('RED'), pot('RED', 'RED_1'), pot('BLACK'), pot('CUE')]);
    expect(next.players.A.score).toBe(0);
    expect(next.players.B.score).toBe(7);
    expect(next.redsRemaining).toBe(14);
    expect(next.activePlayer).toBe('B');
    expect(next.balls.find(ball => ball.id === 'BLACK')!.onTable).toBe(true);
    expect(next.balls.find(ball => ball.id === 'RED_1')!.onTable).toBe(false);
    expect(next.meta).toMatchObject({ state: { ballInHand: true } });
  });

  test('a foul removing the last red starts the opponent on yellow', () => {
    const state = fresh();
    state.redsRemaining = 1;
    const next = rules.applyShot(state, [hit('BLACK'), pot('RED', 'RED_1')]);
    expect(next.redsRemaining).toBe(0);
    expect(next.phase).toBe('COLORS_ORDER');
    expect(next.ballOn).toEqual(['YELLOW']);
    expect(next.colorOnAfterRed).toBe(false);
  });

  test('cleared colours remain down, but colours in a clearance foul are respotted', () => {
    const yellow = rules.applyShot(clearance(), [hit('YELLOW'), pot('YELLOW')]);
    expect(yellow.ballOn).toEqual(['GREEN']);
    expect(yellow.balls.find(ball => ball.id === 'YELLOW')!.onTable).toBe(false);
    const foul = rules.applyShot(yellow, [hit('GREEN'), pot('GREEN'), pot('BLACK')]);
    expect(foul.ballOn).toEqual(['GREEN']);
    expect(foul.players.B.score).toBe(7);
    expect(foul.balls.find(ball => ball.id === 'GREEN')!.onTable).toBe(true);
    expect(foul.balls.find(ball => ball.id === 'BLACK')!.onTable).toBe(true);
  });

  test('a full fifteen-red maximum break finishes at 147', () => {
    let state = fresh();
    for (let red = 1; red <= 15; red++) {
      state = rules.applyShot(state, [hit('RED'), pot('RED', `red_${red}`)]);
      state = rules.applyShot(state, [hit('BLACK'), pot('BLACK')]);
      expect(state.foul).toBeUndefined();
    }
    for (const color of colors) state = rules.applyShot(state, [hit(color), pot(color)]);
    expect(state.players.A.score).toBe(147);
    expect(state.players.A.highestBreak).toBe(147);
    expect(state.currentBreak).toBe(147);
    expect(state.frameOver).toBe(true);
    expect(state.winner).toBe('A');
  });
});

describe('Snooker shot event integrity', () => {
  test('counts a ball once across duplicate events and case variants', () => {
    const next = rules.applyShot(fresh(), [hit('RED'), pot('RED', 'red_8'), pot('RED', 'RED_8')]);
    expect(next.players.A.score).toBe(1);
    expect(next.redsRemaining).toBe(14);
    expect(next.balls.find(ball => ball.id === 'RED_8')!.onTable).toBe(false);
    expect(next.balls.find(ball => ball.id === 'RED_1')!.onTable).toBe(true);
  });

  test('stale, unknown and off-table IDs never consume an available replacement red', () => {
    const state = fresh();
    state.redsRemaining = 14;
    const removed = state.balls.find(ball => ball.id === 'RED_1')!;
    removed.onTable = false;
    removed.potted = true;
    const next = rules.applyShot(state, [hit('RED'), pot('RED', 'red_1'), pot('RED', 'RED_99'), pot('RED_100')]);
    expect(next.players.A.score).toBe(0);
    expect(next.redsRemaining).toBe(14);
    expect(next.activePlayer).toBe('B');
    expect(next.balls.find(ball => ball.id === 'RED_2')!.onTable).toBe(true);
  });

  test('uses a known ID rather than a conflicting colour label', () => {
    const next = rules.applyShot(fresh(), [hit('RED'), pot('RED', 'black')]);
    expect(next.foul?.points).toBe(7);
    expect(next.redsRemaining).toBe(15);
    expect(next.balls.find(ball => ball.id === 'BLACK')!.onTable).toBe(true);
  });

  test('stale colour pot events do not score again or restore a cleared colour', () => {
    const state = clearance('GREEN');
    const next = rules.applyShot(state, [hit('GREEN'), pot('YELLOW', 'YELLOW')]);
    expect(next.players.A.score).toBe(0);
    expect(next.foul).toBeUndefined();
    expect(next.balls.find(ball => ball.id === 'YELLOW')!.onTable).toBe(false);
  });

  test('a newly placed cue is in play and can be scratched again', () => {
    const scratch = rules.applyShot(fresh(), [hit('RED'), pot('CUE')]);
    const next = rules.applyShot(scratch, [hit('RED'), pot('CUE')], { placedFromHand: true });
    expect(next.foul?.reason).toBe('cue ball potted');
    expect(next.players.A.score).toBe(4);
    expect(next.meta).toMatchObject({ state: { ballInHand: true } });
  });

  test('does not mutate the input frame or shot events', () => {
    const state = afterRed();
    const events = [hit('PINK'), pot('YELLOW')];
    const previous = JSON.stringify({ state, events });
    rules.applyShot(state, events);
    expect(JSON.stringify({ state, events })).toBe(previous);
  });
});

describe('Snooker free balls', () => {
  test('a free-ball option can be declined for an ordinary red', () => {
    const state = fresh();
    state.freeBall = true;
    const next = rules.applyShot(state, [hit('RED'), pot('RED')]);
    expect(next.foul).toBeUndefined();
    expect(next.players.A.score).toBe(1);
    expect(next.freeBall).toBe(false);
  });

  test('a free ball and real reds score separately, with only the colour respotted', () => {
    const next = rules.applyShot(fresh(), [hit('BLACK'), pot('BLACK'), pot('RED', 'RED_2')], {
      freeBall: true, nominatedBall: 'BLACK'
    });
    expect(next.foul).toBeUndefined();
    expect(next.players.A.score).toBe(2);
    expect(next.redsRemaining).toBe(14);
    expect(next.colorOnAfterRed).toBe(true);
    expect(next.balls.find(ball => ball.id === 'BLACK')!.onTable).toBe(true);
  });

  test('a free ball may plant the real ball on without being potted itself', () => {
    const next = rules.applyShot(clearance(), [hit('BLACK'), pot('YELLOW')], {
      freeBall: true, nominatedBall: 'BLACK'
    });
    expect(next.foul).toBeUndefined();
    expect(next.players.A.score).toBe(2);
    expect(next.ballOn).toEqual(['GREEN']);
  });

  test('potting a free ball alone scores the clearance target and keeps that target on', () => {
    const next = rules.applyShot(clearance(), [hit('BLACK'), pot('BLACK')], {
      freeBall: true, nominatedBall: 'BLACK'
    });
    expect(next.foul).toBeUndefined();
    expect(next.players.A.score).toBe(2);
    expect(next.ballOn).toEqual(['YELLOW']);
    expect(next.activePlayer).toBe('A');
    expect(next.balls.find(ball => ball.id === 'BLACK')!.onTable).toBe(true);
  });

  test('potting both a clearance target and its free ball scores only the target once', () => {
    const next = rules.applyShot(clearance(), [hit('BLACK'), pot('BLACK'), pot('YELLOW')], {
      freeBall: true, nominatedBall: 'BLACK'
    });
    expect(next.foul).toBeUndefined();
    expect(next.players.A.score).toBe(2);
    expect(next.ballOn).toEqual(['GREEN']);
    expect(next.balls.find(ball => ball.id === 'BLACK')!.onTable).toBe(true);
    expect(next.balls.find(ball => ball.id === 'YELLOW')!.onTable).toBe(false);
  });

  test('a nominated substitute takes the real ball-on value when a scratch occurs', () => {
    const next = rules.applyShot(fresh(), [hit('BLACK'), pot('BLACK'), pot('CUE')], {
      freeBall: true, nominatedBall: 'BLACK'
    });
    expect(next.foul?.points).toBe(4);
    expect(next.players.A.score).toBe(0);
    expect(next.players.B.score).toBe(4);
  });

  test('a wrong higher-valued ball still determines the free-ball foul penalty', () => {
    const next = rules.applyShot(fresh(), [hit('BLUE')], { freeBall: true, nominatedBall: 'BLACK' });
    expect(next.foul?.points).toBe(5);
  });

  test.each(['YELLOW', 'CUE', 'RED', 'not-a-ball'])('rejects invalid free-ball nomination %s on yellow', nominatedBall => {
    const next = rules.applyShot(clearance(), [hit('BLACK')], { freeBall: true, nominatedBall });
    expect(next.foul?.reason).toBe('invalid nomination');
  });

  test('only a reported snooker following a foul awards another free ball', () => {
    const foul = rules.applyShot(fresh(), [hit('BLACK')], { snookered: true });
    expect(foul.freeBall).toBe(true);
    expect(foul.activePlayer).toBe('B');
    const safety = rules.applyShot(fresh(), [hit('RED')], { snookered: true });
    expect(safety.freeBall).toBe(false);
  });
});
