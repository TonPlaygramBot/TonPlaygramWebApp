import { SnookerRoyalRules } from '../src/rules/SnookerRoyalRules.ts';
import { authorizeSnookerActor, validateSnookerShotState } from '../bot/utils/snookerRealtimeValidation.js';

const table = { gameType: 'snookerroyale', started: true, players: [{ id: 'first' }, { id: 'second' }], currentTurn: 'first' };

test('relay accepts real rules results, foul decisions and restored miss positions', () => {
  const rules = new SnookerRoyalRules();
  const initial = rules.getInitialFrame('First', 'Second');
  const missed = rules.applyShot(initial, [{ type: 'END_TURN' }], {
    contactMade: false, clearPathToBallOn: true, fullBallContactAvailable: true
  });
  expect(missed.meta.foulChoice.miss).toBe(true);
  expect(validateSnookerShotState(missed, initial)).toBe(true);
  expect(authorizeSnookerActor(table, { state: missed }, 'second').ok).toBe(true);
  const replaced = rules.resolveFoulChoice(missed, 'replace');
  expect(replaced.activePlayer).toBe('A');
  expect(validateSnookerShotState(replaced, missed)).toBe(true);
  expect(authorizeSnookerActor(table, { state: replaced }, 'first').ok).toBe(true);
});

test('relay rejects malformed nested replacement layout before it reaches the renderer', () => {
  const rules = new SnookerRoyalRules();
  const initial = rules.getInitialFrame('First', 'Second');
  const missed = rules.applyShot(initial, [{ type: 'END_TURN' }], { contactMade: false });
  missed.meta.foulChoice.layout = [{ id: 'cue', active: true, pos: { x: NaN, y: 0 } }];
  expect(validateSnookerShotState(missed, initial)).toBe(false);
});

test('relay validates rule replacement ball positions as well as render snapshots', () => {
  const rules = new SnookerRoyalRules();
  const initial = rules.getInitialFrame('First', 'Second');
  const missed = rules.applyShot(initial, [{ type: 'END_TURN' }], {
    contactMade: false, clearPathToBallOn: true, fullBallContactAvailable: true
  });
  missed.meta.foulChoice.replacement.balls[0].position = { x: Infinity, y: 0 };
  expect(validateSnookerShotState(missed, initial)).toBe(false);
});

test('relay accepts a real deciding-black draw and choice but rejects an invalid draw owner', () => {
  const rules = new SnookerRoyalRules();
  const state = rules.getInitialFrame('First', 'Second');
  state.phase = 'COLORS_ORDER';
  state.redsRemaining = 0;
  state.ballOn = ['BLACK'];
  state.meta.colorsRemaining = ['BLACK'];
  state.players.A.score = 10;
  state.players.B.score = 17;
  state.balls.forEach(ball => {
    ball.onTable = ['BLACK', 'CUE'].includes(ball.color);
    ball.potted = !ball.onTable;
  });
  const tied = rules.applyShot(state, [
    { type: 'HIT', firstContact: 'BLACK' },
    { type: 'POTTED', ball: 'BLACK', pocket: 'TL' }
  ], { decidingBlackDrawWinner: 'A' });
  expect(validateSnookerShotState(tied, state)).toBe(true);
  const chosen = rules.resolveDecidingBlackChoice(tied, 'opponent');
  expect(chosen.activePlayer).toBe('B');
  expect(validateSnookerShotState(chosen, tied)).toBe(true);
  tied.meta.decidingBlackChoice.winner = 'C';
  expect(validateSnookerShotState(tied, state)).toBe(false);
});
