import { SnookerRules } from '../src/rules/SnookerRules';
import { Referee } from '../src/core/Referee';

const pocket = 'TR';

describe('Snooker core', () => {
  test('basic rotation and colors order', () => {
    const rules = new SnookerRules();
    const ref = new Referee(rules);
    let state = rules.getInitialFrame('p1', 'p2');
    // leave only one red
    const reds = state.balls.filter((b) => b.color === 'RED');
    reds.slice(1).forEach((b) => (b.onTable = false));
    state.redsRemaining = 1;

    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'RED' },
      { type: 'POTTED', ball: 'RED', pocket },
    ]);
    expect(state.redsRemaining).toBe(0);
    expect(state.ballOn).toEqual(['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK']);

    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'BLACK' },
      { type: 'POTTED', ball: 'BLACK', pocket },
    ]);
    expect(state.phase).toBe('COLORS_ORDER');
    expect(state.ballOn).toEqual(['YELLOW']);

    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'YELLOW' },
      { type: 'POTTED', ball: 'YELLOW', pocket },
    ]);
    expect(state.ballOn).toEqual(['GREEN']);
    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'GREEN' },
      { type: 'POTTED', ball: 'GREEN', pocket },
    ]);
    expect(state.ballOn).toEqual(['BROWN']);
  });

  test('scoring red and color', () => {
    const rules = new SnookerRules();
    const ref = new Referee(rules);
    let state = rules.getInitialFrame('p1', 'p2');
    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'RED' },
      { type: 'POTTED', ball: 'RED', pocket },
    ]);
    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'BLACK' },
      { type: 'POTTED', ball: 'BLACK', pocket },
    ]);
    expect(state.players.A.score).toBe(8);
  });

  test('foul minimum four when red on', () => {
    const rules = new SnookerRules();
    const ref = new Referee(rules);
    let state = rules.getInitialFrame('p1', 'p2');
    state = ref.applyShot(state, [{ type: 'HIT', firstContact: 'YELLOW' }]);
    expect(state.players.B.score).toBe(4);
    expect(state.activePlayer).toBe('B');
    expect(state.ballOn).toEqual(['RED']);
  });

  test('foul seven when black on', () => {
    const rules = new SnookerRules();
    const ref = new Referee(rules);
    let state = rules.getInitialFrame('p1', 'p2');
    state.redsRemaining = 0;
    state.phase = 'COLORS_ORDER';
    ['RED', 'YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK'].forEach((c) =>
      state.balls.filter((b) => b.color === c).forEach((b) => (b.onTable = false))
    );
    state.ballOn = ['BLACK'];
    state = ref.applyShot(state, [{ type: 'HIT', firstContact: 'YELLOW' }]);
    expect(state.players.B.score).toBe(7);
  });

  test('free ball surrogate scores as ball on', () => {
    const rules = new SnookerRules();
    const ref = new Referee(rules);
    let state = rules.getInitialFrame('p1', 'p2');
    state = ref.awardFoul(state, 4, 'test'); // B to play
    state = ref.setFreeBall(state, true);
    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'YELLOW' },
      { type: 'POTTED', ball: 'YELLOW', pocket },
    ]);
    expect(state.players.B.score).toBe(5); // 4 + 1
    expect(state.ballOn).toEqual(['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK']);
  });

  test('colors respot logic', () => {
    const rules = new SnookerRules();
    const ref = new Referee(rules);
    let state = rules.getInitialFrame('p1', 'p2');
    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'RED' },
      { type: 'POTTED', ball: 'RED', pocket },
    ]);
    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'BLACK' },
      { type: 'POTTED', ball: 'BLACK', pocket },
    ]);
    const black = state.balls.find((b) => b.color === 'BLACK')!;
    expect(black.onTable).toBe(true);

    state.balls.filter((b) => b.color === 'RED').forEach((b) => (b.onTable = false));
    state.redsRemaining = 0;
    state.phase = 'COLORS_ORDER';
    state.ballOn = ['YELLOW'];
    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'YELLOW' },
      { type: 'POTTED', ball: 'YELLOW', pocket },
    ]);
    const yellow = state.balls.find((b) => b.color === 'YELLOW')!;
    expect(yellow.onTable).toBe(false);
  });

  test('frame over and winner', () => {
    const rules = new SnookerRules();
    const ref = new Referee(rules);
    let state = rules.getInitialFrame('p1', 'p2');
    state.redsRemaining = 0;
    state.phase = 'COLORS_ORDER';
    ['RED', 'YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK'].forEach((c) =>
      state.balls.filter((b) => b.color === c).forEach((b) => (b.onTable = false))
    );
    state.ballOn = ['BLACK'];
    state.players.A.score = 10;
    state.players.B.score = 5;
    state = ref.applyShot(state, [
      { type: 'HIT', firstContact: 'BLACK' },
      { type: 'POTTED', ball: 'BLACK', pocket },
    ]);
    expect(state.frameOver).toBe(true);
    expect(state.winner).toBe('A');
  });

  test('snapshot and declare miss restores', () => {
    const rules = new SnookerRules();
    const ref = new Referee(rules);
    let state = rules.getInitialFrame('p1', 'p2');
    const snap = ref.snapshot(state);
    state = ref.applyShot(state, [{ type: 'HIT', firstContact: null }]);
    const restored = ref.declareMissAndOfferReplay(state, snap);
    expect(restored).toEqual(snap);
  });
});
