import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
import { FrameState, ShotEvent } from '../src/types';

const rules = new SnookerRoyalRules();
const fresh = () => rules.getInitialFrame('Player', 'Opponent');
const hit = (id: string): ShotEvent => ({ type: 'HIT', firstContact: id, ballId: id });
const pot = (id: string): ShotEvent => ({ type: 'POTTED', ball: id, ballId: id, pocket: 'TL' });
const fullBallMiss = (state: FrameState) => rules.applyShot(state, [], {
  contactMade: false, clearPathToBallOn: true, fullBallContactAvailable: true
});

describe('snooker foul-and-miss decisions', () => {
  test('a proven available direct contact offers replacement after a miss', () => {
    const next = fullBallMiss(fresh());
    expect(next.foul).toEqual({ points: 4, reason: 'no contact' });
    expect(next.meta).toMatchObject({ foulChoice: { miss: true, missCount: 1 } });
  });

  test('an obstructed failed escape is not automatically called a miss', () => {
    const next = rules.applyShot(fresh(), [], { contactMade: false, clearPathToBallOn: false });
    expect(next.foul?.points).toBe(4);
    expect((next.meta as any).foulChoice.replacement).toBeUndefined();
    expect(rules.resolveFoulChoice(next, 'replace')).toBe(next);
  });

  test('a scratch after correct contact cannot be a miss', () => {
    const next = rules.applyShot(fresh(), [hit('RED_1'), pot('CUE')], {
      clearPathToBallOn: true, fullBallContactAvailable: true
    });
    expect((next.meta as any).foulChoice.miss).toBe(false);
  });

  test('replacement restores removed reds, phase and in-hand state but retains penalties', () => {
    const before = fresh();
    before.balls[0].position = { x: 4, y: 8 };
    const missed = rules.applyShot(before, [hit('BLACK'), pot('RED_1')], {
      clearPathToBallOn: true, fullBallContactAvailable: true
    });
    const serialized = JSON.parse(JSON.stringify(missed));
    const replaced = rules.resolveFoulChoice(serialized, 'replace');
    expect(replaced.activePlayer).toBe('A');
    expect(replaced.players.B.score).toBe(7);
    expect(replaced.redsRemaining).toBe(15);
    expect(replaced.balls).toEqual(before.balls);
    expect(replaced.balls).not.toBe(before.balls);
    expect(replaced.meta).toMatchObject({ state: { ballInHand: true },
      missSequence: { count: 1, warningIssued: false } });
    expect((serialized.meta as any).foulChoice).toBeDefined();
  });

  test('a post-red miss replacement restores colour choice and never the previous break', () => {
    const red = rules.applyShot(fresh(), [hit('RED_1'), pot('RED_1')]);
    const missed = fullBallMiss(red);
    const replaced = rules.resolveFoulChoice(missed, 'replace');
    expect(replaced.colorOnAfterRed).toBe(true);
    expect(replaced.ballOn).toContain('BLACK');
    expect(replaced.currentBreak).toBe(0);
    expect(replaced.players.A.highestBreak).toBe(1);
    expect(replaced.players.B.score).toBe(7);
  });

  test('no first automatic miss when snookers are already needed', () => {
    const state = fresh();
    state.players.A.score = 148;
    expect((fullBallMiss(state).meta as any).foulChoice.miss).toBe(false);
  });

  test('no first automatic miss when the penalty makes snookers necessary', () => {
    const state = fresh();
    state.players.B.score = 144;
    expect((fullBallMiss(state).meta as any).foulChoice.miss).toBe(false);
  });

  test('second replacement warns and third full-ball miss awards the frame', () => {
    const first = rules.resolveFoulChoice(fullBallMiss(fresh()), 'replace');
    const secondMiss = fullBallMiss(first);
    expect(secondMiss.frameOver).toBe(false);
    const warned = rules.resolveFoulChoice(secondMiss, 'replace');
    expect(warned.meta).toMatchObject({ missWarning: true,
      missSequence: { count: 2, warningIssued: true } });
    const third = fullBallMiss(warned);
    expect(third.frameOver).toBe(true);
    expect(third.winner).toBe('B');
    expect(third.players.B.score).toBe(12);
    expect(third.ballOn).toEqual([]);
    expect((third.meta as any).foulChoice).toBeUndefined();
  });

  test('a repeated full-ball miss remains a miss when penalties change the score threshold', () => {
    const state = fresh();
    state.players.B.score = 140;
    const first = rules.resolveFoulChoice(fullBallMiss(state), 'replace');
    const second = fullBallMiss(first);
    expect((second.meta as any).foulChoice).toMatchObject({ miss: true, missCount: 2 });
  });

  test.each(['play', 'return'] as const)('%s from the position left ends the repeated-miss sequence', choice => {
    const first = rules.resolveFoulChoice(fullBallMiss(fresh()), 'replace');
    const second = rules.resolveFoulChoice(fullBallMiss(first), choice);
    expect((second.meta as any).missSequence).toBeUndefined();
    expect((second.meta as any).missWarning).toBe(false);
    expect(fullBallMiss(second).frameOver).toBe(false);
  });

  test('edge-only misses never cause the three-miss frame loss', () => {
    let state = fresh();
    for (let attempt = 0; attempt < 4; attempt++) {
      const miss = rules.applyShot(state, [], { contactMade: false, clearPathToBallOn: true });
      expect(miss.frameOver).toBe(false);
      state = rules.resolveFoulChoice(miss, 'replace');
      expect((state.meta as any).missWarning).toBe(false);
    }
  });

  test('accepting the position by shooting ends any pending replacement', () => {
    const miss = fullBallMiss(fresh());
    const next = rules.applyShot(miss, [hit('RED_1')]);
    expect((next.meta as any).foulChoice).toBeUndefined();
    expect(rules.resolveFoulChoice(next, 'replace')).toBe(next);
  });

  test('miss and replacement preserve the original input state', () => {
    const state = fresh();
    const original = JSON.stringify(state);
    const replaced = rules.resolveFoulChoice(fullBallMiss(state), 'replace');
    expect(JSON.stringify(state)).toBe(original);
    expect(replaced.freeBall).toBe(false);
  });
});

describe('snooker touching balls and off-table balls', () => {
  test('playing away from a touching red fulfils contact without another hit', () => {
    const next = rules.applyShot(fresh(), [], { contactMade: false,
      touchingBallIds: ['RED_1'], touchingBallPlayedAway: true });
    expect(next.foul).toBeUndefined();
    expect(next.activePlayer).toBe('B');
  });

  test('a later contact with a colour is permitted after playing away from a touching red', () => {
    const next = rules.applyShot(fresh(), [hit('BLACK')], {
      touchingBallIds: ['RED_1'], touchingBallPlayedAway: true });
    expect(next.foul).toBeUndefined();
  });

  test('a legal later contact with black does not raise a touching-red scratch penalty', () => {
    const next = rules.applyShot(fresh(), [hit('BLACK'), pot('CUE')], {
      touchingBallIds: ['RED_1'], touchingBallPlayedAway: true });
    expect(next.foul?.points).toBe(4);
  });

  test('touching a ball not on does not excuse a no-contact stroke', () => {
    const next = rules.applyShot(fresh(), [], { contactMade: false,
      touchingBallIds: ['BLACK'], touchingBallPlayedAway: true });
    expect(next.foul?.reason).toBe('no contact');
  });

  test('a declared touching colour can be played away from after red', () => {
    const red = rules.applyShot(fresh(), [hit('RED_1'), pot('RED_1')]);
    const next = rules.applyShot(red, [], { contactMade: false, declaredBall: 'BLACK',
      touchingBallIds: ['BLACK'], touchingBallPlayedAway: true });
    expect(next.foul).toBeUndefined();
  });

  test('playing into a touching object ball is a push stroke', () => {
    const next = rules.applyShot(fresh(), [hit('BLACK')], {
      touchingBallIds: ['BLACK'], touchingBallPlayedAway: false });
    expect(next.foul).toEqual({ points: 7, reason: 'push stroke' });
  });

  test('an unmoved touching black is not involved in a push into a touching red', () => {
    const next = rules.applyShot(fresh(), [hit('RED_1')], {
      touchingBallIds: ['RED_1', 'BLACK'], touchingBallPlayedAway: false,
      pushedTouchingBallIds: ['RED_1'] });
    expect(next.foul).toEqual({ points: 4, reason: 'push stroke' });
  });

  test('off-table reds stay down, colours respot and the highest foul value wins', () => {
    const next = rules.applyShot(fresh(), [hit('RED_1')], {
      offTableBallIds: ['RED_2', 'BLACK'] });
    expect(next.foul).toEqual({ points: 7, reason: 'ball forced off table' });
    expect(next.redsRemaining).toBe(14);
    expect(next.balls.find(ball => ball.id === 'RED_2')?.onTable).toBe(false);
    expect(next.balls.find(ball => ball.id === 'BLACK')?.onTable).toBe(true);
  });

  test('a cue forced off the table grants in hand', () => {
    const next = rules.applyShot(fresh(), [hit('RED_1')], { offTableBallIds: ['cue'] });
    expect(next.meta).toMatchObject({ state: { ballInHand: true } });
    expect(next.balls.find(ball => ball.id === 'CUE')?.onTable).toBe(false);
  });

  test('duplicate pot/off-table notifications remove a red only once', () => {
    const next = rules.applyShot(fresh(), [hit('RED_1'), pot('RED_1')], {
      offTableBallIds: ['RED_1', 'red_1', 'RED_1', 'unknown'] });
    expect(next.redsRemaining).toBe(14);
    expect(next.players.A.score).toBe(0);
  });
});
