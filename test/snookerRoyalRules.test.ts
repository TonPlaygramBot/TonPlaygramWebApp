import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
import { BallColor, FrameState, ShotEvent } from '../src/types';

const rules = new SnookerRoyalRules();
const hit = (color: BallColor): ShotEvent => ({ type: 'HIT', firstContact: color });
const pot = (color: BallColor, ballId?: string): ShotEvent => ({ type: 'POTTED', ball: color, pocket: 'TM', ballId });
const afterRed = () => rules.applyShot(rules.getInitialFrame('You', 'Rival'), [hit('RED'), pot('RED', 'RED_1')]);
const clearance = (): FrameState => ({
  ...rules.getInitialFrame('You', 'Rival'), phase: 'COLORS_ORDER', redsRemaining: 0, ballOn: ['YELLOW']
});

describe('Snooker Royal scoring and frame progression', () => {
  test('a different first colour cannot be used to pot the nominated colour', () => {
    const next = rules.applyShot(afterRed(), [hit('BLUE'), pot('BLACK')], { declaredBall: 'BLACK' });
    expect(next.foul?.points).toBe(7);
    expect(next.players.A.score).toBe(1);
    expect(next.activePlayer).toBe('B');
  });

  test('without an explicit nomination, first colour contact determines the target', () => {
    const next = rules.applyShot(afterRed(), [hit('BLUE'), pot('PINK')]);
    expect(next.foul?.points).toBe(6);
    expect(next.players.A.score).toBe(1);
    expect(next.balls.find(b => b.color === 'PINK')?.onTable).toBe(true);
  });

  test('a scratch after contacting yellow is four points, not seven', () => {
    const next = rules.applyShot(afterRed(), [hit('YELLOW'), pot('CUE')]);
    expect(next.foul?.points).toBe(4);
    expect(next.meta?.state).toMatchObject({ ballInHand: true });
  });

  test('an already removed ball cannot score again', () => {
    const initial = rules.getInitialFrame('You', 'Rival');
    initial.balls[0].onTable = false;
    initial.balls[0].potted = true;
    initial.redsRemaining = 14;
    const next = rules.applyShot(initial, [hit('RED'), pot('RED', 'RED_1')]);
    expect(next.players.A.score).toBe(0);
    expect(next.redsRemaining).toBe(14);
    expect(next.activePlayer).toBe('B');
  });

  test('legal free-ball plant during clearance scores the actual colour', () => {
    const next = rules.applyShot({ ...clearance(), freeBall: true }, [hit('BLACK'), pot('YELLOW')], { nominatedBall: 'BLACK' });
    expect(next.foul).toBeUndefined();
    expect(next.players.A.score).toBe(2);
    expect(next.ballOn).toEqual(['GREEN']);
  });

  test('potting both free ball and colour scores the colour only once', () => {
    const next = rules.applyShot({ ...clearance(), freeBall: true }, [hit('BLACK'), pot('YELLOW'), pot('BLACK')], { nominatedBall: 'BLACK' });
    expect(next.foul).toBeUndefined();
    expect(next.players.A.score).toBe(2);
    expect(next.balls.find(b => b.color === 'BLACK')?.onTable).toBe(true);
    expect(next.balls.find(b => b.color === 'YELLOW')?.onTable).toBe(false);
  });

  test('free ball alone is respotted and does not advance clearance', () => {
    const next = rules.applyShot({ ...clearance(), freeBall: true }, [hit('BLACK'), pot('BLACK')], { nominatedBall: 'BLACK' });
    expect(next.foul).toBeUndefined();
    expect(next.players.A.score).toBe(2);
    expect(next.ballOn).toEqual(['YELLOW']);
  });

  test('a maximum break keeps every colour available until the clearance', () => {
    let state = rules.getInitialFrame('You', 'Rival');
    for (let red = 1; red <= 15; red++) {
      state = rules.applyShot(state, [hit('RED'), pot('RED', `RED_${red}`)]);
      state = rules.applyShot(state, [hit('BLACK'), pot('BLACK')]);
      expect(state.foul).toBeUndefined();
      expect(state.balls.find(b => b.color === 'BLACK')?.onTable).toBe(true);
    }
    expect(state.phase).toBe('COLORS_ORDER');
    for (const color of ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'] as BallColor[]) {
      state = rules.applyShot(state, [hit(color), pot(color)]);
    }
    expect(state.players.A.score).toBe(147);
    expect(state.currentBreak).toBe(147);
    expect(state.frameOver).toBe(true);
    expect(state.winner).toBe('A');
  });

  test('a foul removes reds but restores colours and switches to clearance', () => {
    const initial = rules.getInitialFrame('You', 'Rival');
    initial.redsRemaining = 1;
    const next = rules.applyShot(initial, [hit('RED'), pot('RED', 'RED_1'), pot('BLACK')]);
    expect(next.foul?.points).toBe(7);
    expect(next.redsRemaining).toBe(0);
    expect(next.ballOn).toEqual(['YELLOW']);
    expect(next.balls.find(b => b.color === 'BLACK')?.onTable).toBe(true);
  });

  test('finished frames cannot accept another shot', () => {
    const done = { ...clearance(), frameOver: true, winner: 'A' as const };
    expect(rules.applyShot(done, [])).toEqual(done);
  });
});
