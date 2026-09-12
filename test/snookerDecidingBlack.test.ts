import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules';
const rules = new SnookerRoyalRules();
function blackOnly(a = 10, b = 17) {
  const s = rules.getInitialFrame('A', 'B');
  s.phase = 'COLORS_ORDER';
  s.redsRemaining = 0;
  s.ballOn = ['BLACK'];
  s.meta!.colorsRemaining = ['BLACK'];
  s.players.A.score = a;
  s.players.B.score = b;
  s.balls.forEach((ball) => {
    ball.onTable = ['BLACK', 'CUE'].includes(ball.color);
    ball.potted = !ball.onTable;
  });
  return s;
}
test('a tied final black is respotted with ball in hand and the supplied toss winner', () => {
  const next = rules.applyShot(
    blackOnly(),
    [
      { type: 'HIT', firstContact: 'BLACK' },
      { type: 'POTTED', ball: 'BLACK', pocket: 'TL' }
    ],
    { respottedBlackStarter: 'B' }
  );
  expect(next.frameOver).toBe(false);
  expect(next.winner).toBeUndefined();
  expect(next.activePlayer).toBe('B');
  expect(next.ballOn).toEqual(['BLACK']);
  expect(next.balls.find((b) => b.color === 'BLACK')!.onTable).toBe(true);
  expect(next.meta).toMatchObject({
    respottedBlack: true,
    state: { ballInHand: true }
  });
  const finish = rules.applyShot(next, [{ type: 'FOUL', reason: 'in-off' }]);
  expect(finish.frameOver).toBe(true);
  expect(finish.winner).toBe('A');
  expect(rules.applyShot(finish, [{ type: 'FOUL', reason: 'duplicate' }])).toBe(
    finish
  );
});
test('a final-black foul that ties scores also starts a deciding black', () => {
  const next = rules.applyShot(
    blackOnly(17, 10),
    [{ type: 'FOUL', reason: 'missed black' }],
    { respottedBlackStarter: 'A' }
  );
  expect(next.frameOver).toBe(false);
  expect(next.players.B.score).toBe(17);
  expect(next.meta!.respottedBlack).toBe(true);
});
test('highest break survives a turn change', () => {
  const first = rules.applyShot(rules.getInitialFrame('A', 'B'), [
    { type: 'HIT', firstContact: 'RED' },
    { type: 'POTTED', ball: 'RED', pocket: 'TL' }
  ]);
  const second = rules.applyShot(first, [
    { type: 'HIT', firstContact: 'BLACK' },
    { type: 'POTTED', ball: 'BLACK', pocket: 'TL' }
  ]);
  const miss = rules.applyShot(second, [{ type: 'HIT', firstContact: 'RED' }]);
  expect(miss.currentBreak).toBe(0);
  expect(miss.players.A.highestBreak).toBe(8);
});

test('the final black still contributes to the highest break when scores tie', () => {
  const state = blackOnly();
  state.currentBreak = 10;
  const next = rules.applyShot(state, [{ type: 'HIT', firstContact: 'BLACK' }, { type: 'POTTED', ball: 'BLACK', pocket: 'TL' }]);
  expect(next.players.A.highestBreak).toBe(17);
});
