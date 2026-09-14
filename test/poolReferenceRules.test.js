import { BcaEightBall } from '../lib/bcaEightBall.js';
import { NineBall } from '../lib/nineBall.js';

const referenceEight = () => new BcaEightBall({ profile: 'reference' });
const referenceNine = () => new NineBall({ profile: 'reference' });

describe('Pool Royal reference eight-ball profile', () => {
  test('one group on the opening shot assigns groups and retains the shooter', () => {
    const game = referenceEight();
    const shot = game.shotTaken({ contactOrder: [1], potted: [1, 2] });
    expect(shot.foul).toBe(false);
    expect(shot.nextPlayer).toBe('A');
    expect(game.state.assignments).toEqual({ A: 'SOLID', B: 'STRIPE' });
  });

  test('mixed opening pots stay open; a legal dry opening shot passes without a four-ball gate', () => {
    const game = referenceEight();
    game.shotTaken({ contactOrder: [1], potted: [1, 9] });
    expect(game.state.assignments).toEqual({ A: null, B: null });
    expect(game.state.currentPlayer).toBe('A');
    expect(referenceEight().shotTaken({ contactOrder: [1], noCushionAfterContact: false }))
      .toMatchObject({ legal: true, nextPlayer: 'B', ballInHandNext: false });
  });

  test('own plus opponent pots retain the inning; opponent-only pots pass without a foul', () => {
    const game = referenceEight();
    game.shotTaken({ contactOrder: [1], potted: [1] });
    expect(game.shotTaken({ contactOrder: [2], potted: [2, 9] }))
      .toMatchObject({ legal: true, nextPlayer: 'A' });
    expect(game.shotTaken({ contactOrder: [3], potted: [10] }))
      .toMatchObject({ legal: true, nextPlayer: 'B' });
  });

  test.each([
    [{ contactOrder: [], potted: [] }, 'no contact'],
    [{ contactOrder: [8], potted: [] }, 'wrong first contact'],
    [{ contactOrder: [1], potted: [], noCushionAfterContact: true }, 'no cushion'],
    [{ contactOrder: [1], potted: [0] }, 'scratch']
  ])('ordinary foul transfers ball in hand: %s', (shot, reason) => {
    expect(referenceEight().shotTaken(shot)).toMatchObject({
      foul: true, reason, nextPlayer: 'B', ballInHandNext: true, frameOver: false
    });
  });

  test('legal contact followed by an early eight spots it and gives ball in hand', () => {
    const game = referenceEight();
    expect(game.shotTaken({ contactOrder: [1], potted: [8] }))
      .toMatchObject({ foul: true, reason: 'potted black early', nextPlayer: 'B', ballInHandNext: true, frameOver: false });
    expect(game.state.ballsOnTable.has(8)).toBe(true);
    expect(game.state.assignments).toEqual({ A: null, B: null });
  });

  test('first contacting and potting the eight on an open table loses', () => {
    const game = referenceEight();
    expect(game.shotTaken({ contactOrder: [8], potted: [8] }))
      .toMatchObject({ foul: true, frameOver: true, winner: 'B', ballInHandNext: false });
  });

  test('last group ball and eight together win after first contacting the group ball', () => {
    const game = referenceEight();
    game.state.assignments = { A: 'SOLID', B: 'STRIPE' };
    game.state.ballsOnTable = new Set([7, 8, 9]);
    expect(game.shotTaken({ contactOrder: [7], potted: [7, 8] }))
      .toMatchObject({ legal: true, frameOver: true, winner: 'A' });
    expect([...game.state.ballsOnTable]).toEqual([9]);
  });

  test('eight plus scratch respots when assigned and any other object ball remains', () => {
    const game = referenceEight();
    game.state.assignments = { A: 'SOLID', B: 'STRIPE' };
    game.state.ballsOnTable = new Set([8, 9]);
    expect(game.shotTaken({ contactOrder: [8], potted: [8, 0] }))
      .toMatchObject({ foul: true, frameOver: false, nextPlayer: 'B', ballInHandNext: true });
    expect(game.state.ballsOnTable.has(8)).toBe(true);
  });

  test('eight plus scratch loses when no other object ball remains', () => {
    const game = referenceEight();
    game.state.assignments = { A: 'SOLID', B: 'STRIPE' };
    game.state.ballsOnTable = new Set([8]);
    expect(game.shotTaken({ contactOrder: [8], potted: [8, 0] }))
      .toMatchObject({ foul: true, frameOver: true, winner: 'B', ballInHandNext: false });
  });

  test('a pot suppresses the cushion requirement but cannot hide wrong first contact', () => {
    const game = referenceEight();
    game.shotTaken({ contactOrder: [1], potted: [1], noCushionAfterContact: true });
    expect(game.state.assignments.A).toBe('SOLID');
    expect(game.shotTaken({ contactOrder: [9], potted: [2], noCushionAfterContact: true }))
      .toMatchObject({ foul: true, reason: 'wrong first contact' });
    expect(game.state.ballsOnTable.has(2)).toBe(false);
  });
});

describe('Pool Royal reference nine-ball profile', () => {
  test('lowest at shot start remains the target even when that ball is potted', () => {
    const game = referenceNine();
    expect(game.shotTaken({ contactOrder: [2], potted: [1, 9] }))
      .toMatchObject({ foul: true, reason: 'wrong first contact', frameOver: false, nextPlayer: 'B' });
    expect(game.state.ballsOnTable.has(1)).toBe(false);
    expect(game.state.ballsOnTable.has(9)).toBe(true);
  });

  test('a legal opening combination on the nine wins', () => {
    expect(referenceNine().shotTaken({ contactOrder: [1], potted: [9], noCushionAfterContact: true }))
      .toMatchObject({ legal: true, frameOver: true, winner: 'A' });
  });

  test('any legal object pot retains the inning even when it is not the lowest ball', () => {
    const game = referenceNine();
    expect(game.shotTaken({ contactOrder: [1], potted: [5] }))
      .toMatchObject({ legal: true, nextPlayer: 'A', frameOver: false });
    expect(game.state.ballsOnTable.has(1)).toBe(true);
  });

  test('nine on a scratch is spotted while other potted balls remain down', () => {
    const game = referenceNine();
    expect(game.shotTaken({ contactOrder: [1], potted: [1, 5, 9, 0] }))
      .toMatchObject({ foul: true, frameOver: false, nextPlayer: 'B', ballInHandNext: true });
    expect([...game.state.ballsOnTable]).toEqual([2, 3, 4, 6, 7, 8, 9]);
  });

  test('dry opening shots use ordinary cushion/contact rules', () => {
    expect(referenceNine().shotTaken({ contactOrder: [1], noCushionAfterContact: false }))
      .toMatchObject({ legal: true, nextPlayer: 'B' });
    expect(referenceNine().shotTaken({ contactOrder: [1], noCushionAfterContact: true }))
      .toMatchObject({ foul: true, reason: 'no cushion' });
  });

  test('three consecutive fouls do not end the reference rack', () => {
    const game = referenceNine();
    for (let index = 0; index < 3; index++) {
      expect(game.shotTaken({ contactOrder: [2] }).frameOver).toBe(false);
      game.shotTaken({ contactOrder: [1], noCushionAfterContact: false });
    }
    expect(game.state.gameOver).toBe(false);
    expect(game.state.currentPlayer).toBe('A');
  });
});

describe('pool shot identity and completed rack safeguards', () => {
  test.each([BcaEightBall, NineBall])('only unique actual balls count as pots in %s', (Game) => {
    const game = new Game({ profile: 'reference' });
    const shot = game.shotTaken({ contactOrder: ['ball_1'], potted: [1, 'ball_1', '1', 'ball_999', 'pocket_2', -1, 2.5] });
    expect(shot.potted).toEqual([1]);
    expect(game.shotTaken({ contactOrder: [2], potted: [1], noCushionAfterContact: true }))
      .toMatchObject({ foul: true, reason: 'no cushion', potted: [] });
  });

  test.each([BcaEightBall, NineBall])('rail aliases describe one physical object ball in %s', (Game) => {
    expect(new Game().shotTaken({ contactOrder: [1], objectBallsToRailAfterContact: ['1', 'ball_1', 1, 'cue'] }))
      .toMatchObject({ foul: true, reason: 'illegal break' });
    expect(new Game().shotTaken({ contactOrder: [1], objectBallsToRailAfterContact: ['ball_1', '2', 3, 'ball_4'] }).legal)
      .toBe(true);
  });

  test('invalid nine-ball pot IDs cannot retain the inning', () => {
    const game = referenceNine();
    expect(game.shotTaken({ contactOrder: [1], potted: [10, 15, 99], noCushionAfterContact: true }))
      .toMatchObject({ foul: true, reason: 'no cushion', potted: [] });
  });

  test('completed rack ignores later shot notifications', () => {
    const game = referenceNine();
    game.shotTaken({ contactOrder: [1], potted: [9] });
    const state = { ...game.state, ballsOnTable: [...game.state.ballsOnTable], foulStreak: { ...game.state.foulStreak } };
    game.shotTaken({ contactOrder: [], potted: [1, 0] });
    expect({ ...game.state, ballsOnTable: [...game.state.ballsOnTable] }).toEqual(state);
  });
});
