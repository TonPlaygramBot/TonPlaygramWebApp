import {
  WHITE,
  BLACK,
  initialBoard,
  collectTurnSequences,
  expandDice,
  applyMove
} from '../../utils/tavullEngine.js';

export const otherSide = (side) => (side === WHITE ? BLACK : WHITE);
export const freshBoard = () => ({
  points: initialBoard(),
  bar: { white: 0, black: 0 },
  off: { white: 0, black: 0 }
});
export function createMatch(target = 5) {
  if (!Number.isInteger(target) || target < 1 || target > 25)
    throw new Error('Invalid match length');
  return {
    board: freshBoard(),
    phase: 'opening',
    turn: null,
    dice: [],
    rolls: [],
    sequences: [],
    cube: { value: 1, owner: null },
    offeredBy: null,
    score: { white: 0, black: 0 },
    target,
    crawford: target === 1,
    crawfordUsed: target === 1,
    result: null,
    gameNumber: 1
  };
}

export function pipCount(board, side) {
  return (
    board.bar[side] * 25 +
    board.points.reduce(
      (sum, point, index) =>
        sum +
        (point.color === side
          ? point.count * (side === WHITE ? index + 1 : 24 - index)
          : 0),
      0
    )
  );
}
export function gameResult(board, winner, cube = 1) {
  const loser = otherSide(winner);
  const inWinnerHome = board.points.some(
    (point, i) =>
      point.color === loser &&
      point.count > 0 &&
      (winner === WHITE ? i < 6 : i >= 18)
  );
  const multiplier =
    board.off[loser] > 0 ? 1 : board.bar[loser] > 0 || inWinnerHome ? 3 : 2;
  return {
    winner,
    kind: ['single', 'gammon', 'backgammon'][multiplier - 1],
    multiplier,
    points: cube * multiplier
  };
}
function finish(match, result) {
  return {
    ...match,
    phase: 'over',
    result,
    dice: [],
    sequences: [],
    offeredBy: null,
    score: {
      ...match.score,
      [result.winner]: match.score[result.winner] + result.points
    }
  };
}
function turnWithDice(match, turn, rolls) {
  const dice = expandDice(rolls);
  const sequences = collectTurnSequences(match.board, turn, rolls).filter(
    (sequence) => sequence.line.length
  );
  return { ...match, phase: 'move', turn, rolls: [...rolls], dice, sequences };
}
export function openingRoll(match, rolls) {
  if (match.phase !== 'opening' || rolls.length !== 2)
    throw new Error('Opening roll unavailable');
  expandDice(rolls);
  if (rolls[0] === rolls[1]) return { ...match, rolls: [...rolls] };
  return turnWithDice(match, rolls[0] > rolls[1] ? WHITE : BLACK, rolls);
}
export function rollTurn(match, rolls) {
  if (match.phase !== 'roll' || rolls.length !== 2)
    throw new Error('Roll unavailable');
  return turnWithDice(match, match.turn, rolls);
}
export function legalFirstMoves(match) {
  const seen = new Set();
  return match.sequences
    .map((sequence) => sequence.line[0])
    .filter((move) => {
      if (!move) return false;
      const key = `${move.from}/${move.to}/${move.die}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function playMove(match, move) {
  if (match.phase !== 'move') throw new Error('Move unavailable');
  const candidates = match.sequences.filter((sequence) => {
    const first = sequence.line[0];
    return (
      first &&
      first.from === move.from &&
      first.to === move.to &&
      first.die === move.die
    );
  });
  if (!candidates.length)
    throw new Error(
      'Move must use the maximum legal dice, including the higher die when required'
    );
  const board = applyMove(match.board, match.turn, move);
  if (board.off[match.turn] === 15)
    return finish(
      { ...match, board },
      gameResult(board, match.turn, match.cube.value)
    );
  const dice = [...match.dice];
  dice.splice(dice.indexOf(move.die), 1);
  // Retain legal suffixes. Re-enumerating a remaining double would grant extra dice.
  const sequences = candidates
    .map((sequence) => ({
      ...sequence,
      line: sequence.line.slice(1),
      usedDice: sequence.usedDice.slice(1)
    }))
    .filter((sequence) => sequence.line.length);
  return { ...match, board, dice, sequences };
}
export function endTurn(match) {
  if (
    match.phase !== 'move' ||
    match.sequences.some((sequence) => sequence.line.length)
  )
    throw new Error('Legal dice must be played before ending the turn');
  return {
    ...match,
    phase: 'roll',
    turn: otherSide(match.turn),
    dice: [],
    sequences: []
  };
}
export function canDouble(match, side = match.turn) {
  return (
    match.phase === 'roll' &&
    match.turn === side &&
    !match.crawford &&
    (match.cube.owner === null || match.cube.owner === side) &&
    Number.isSafeInteger(match.cube.value * 6)
  );
}
export function offerDouble(match, side = match.turn) {
  if (!canDouble(match, side)) throw new Error('Double unavailable');
  return { ...match, phase: 'double', offeredBy: side };
}
export function answerDouble(match, side, accept) {
  if (match.phase !== 'double' || side !== otherSide(match.offeredBy))
    throw new Error('Only the opponent can answer a double');
  if (!accept)
    return finish(match, {
      winner: match.offeredBy,
      kind: 'drop',
      multiplier: 1,
      points: match.cube.value
    });
  return {
    ...match,
    phase: 'roll',
    cube: { value: match.cube.value * 2, owner: side },
    offeredBy: null
  };
}
export function nextGame(match) {
  if (
    match.phase !== 'over' ||
    Math.max(...Object.values(match.score)) >= match.target
  )
    throw new Error('Match is finished or game is still running');
  const crawford =
    !match.crawfordUsed &&
    Object.values(match.score).some((score) => score === match.target - 1);
  return {
    ...createMatch(match.target),
    score: match.score,
    gameNumber: match.gameNumber + 1,
    crawford,
    crawfordUsed: match.crawfordUsed || crawford
  };
}
export function rollDie() {
  // Rejection sampling avoids modulo bias; results are generated before motion.
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= 4294967292);
  return (values[0] % 6) + 1;
}
