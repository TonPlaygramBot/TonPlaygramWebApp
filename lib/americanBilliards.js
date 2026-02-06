const SOLIDS = new Set([1, 2, 3, 4, 5, 6, 7]);
const STRIPES = new Set([9, 10, 11, 12, 13, 14, 15]);
const GROUP_TOTAL = 7;

const opponent = (player) => (player === 'A' ? 'B' : 'A');

const groupForBall = (id) => {
  if (SOLIDS.has(id)) return 'solids';
  if (STRIPES.has(id)) return 'stripes';
  if (id === 8) return 'eight';
  return null;
};

const countGroupRemaining = (ballsOnTable, group) => {
  if (!group) return 0;
  let remaining = 0;
  for (const id of ballsOnTable) {
    if (groupForBall(id) === group) remaining += 1;
  }
  return remaining;
};

const computeScores = (ballsOnTable, assignments) => {
  const scores = { A: 0, B: 0 };
  if (assignments.A) {
    scores.A = GROUP_TOTAL - countGroupRemaining(ballsOnTable, assignments.A);
  }
  if (assignments.B) {
    scores.B = GROUP_TOTAL - countGroupRemaining(ballsOnTable, assignments.B);
  }
  return scores;
};

export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      assignments: { A: null, B: null },
      isOpenTable: true,
      breakInProgress: true,
      scores: { A: 0, B: 0 },
      ballInHand: false,
      frameOver: false,
      winner: null
    };
  }

  shotTaken (shot = {}) {
    const s = this.state;
    const contactOrder = Array.isArray(shot.contactOrder) ? shot.contactOrder : [];
    const pottedList = Array.isArray(shot.potted) ? shot.potted : [];
    if (s.frameOver) {
      return {
        legal: false,
        foul: true,
        reason: 'frame over',
        potted: [],
        nextPlayer: s.currentPlayer,
        ballInHandNext: false,
        frameOver: true,
        winner: s.winner,
        assignments: { ...s.assignments },
        isOpenTable: s.isOpenTable
      };
    }
    const current = s.currentPlayer;
    const opp = opponent(current);
    const firstContact = contactOrder[0];
    const pottedBalls = pottedList.filter((id) => id !== 0);
    const firstGroup = typeof firstContact === 'number' ? groupForBall(firstContact) : null;
    const assignment = s.assignments[current];
    const remainingAssigned = countGroupRemaining(s.ballsOnTable, assignment);

    let foul = false;
    let reason = '';

    if (!firstContact) {
      foul = true;
      reason = 'no contact';
    }

    if (!foul && s.isOpenTable && firstGroup === 'eight') {
      foul = true;
      reason = '8-ball first contact on open table';
    }

    if (!foul && !s.isOpenTable && assignment) {
      if (remainingAssigned > 0 && firstGroup !== assignment) {
        foul = true;
        reason = 'wrong first contact';
      }
      if (remainingAssigned === 0 && firstGroup !== 'eight') {
        foul = true;
        reason = 'must contact 8-ball';
      }
    }

    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    if (!foul && shot.noCushionAfterContact && pottedBalls.length === 0) {
      foul = true;
      reason = 'no rail after contact';
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;

    if (foul) {
      if (pottedBalls.includes(8)) {
        frameOver = true;
        winner = opp;
      } else {
        pottedBalls.forEach((id) => s.ballsOnTable.delete(id));
        nextPlayer = opp;
        s.currentPlayer = opp;
        ballInHandNext = true;
      }
    } else {
      pottedBalls.forEach((id) => s.ballsOnTable.delete(id));
      if (s.isOpenTable && pottedBalls.length > 0) {
        const firstPotted = pottedBalls[0];
        const group = groupForBall(firstPotted);
        if (group === 'solids' || group === 'stripes') {
          s.assignments[current] = group;
          s.assignments[opp] = group === 'solids' ? 'stripes' : 'solids';
          s.isOpenTable = false;
        }
      }

      const remainingAfter = countGroupRemaining(s.ballsOnTable, s.assignments[current]);
      if (pottedBalls.includes(8)) {
        if (s.breakInProgress) {
          frameOver = true;
          winner = current;
        } else if (s.isOpenTable || (s.assignments[current] && remainingAfter > 0)) {
          frameOver = true;
          winner = opp;
        } else {
          frameOver = true;
          winner = current;
        }
      }

      if (!frameOver) {
        const pottedOwnGroup =
          (!s.isOpenTable && s.assignments[current] &&
            pottedBalls.some((id) => groupForBall(id) === s.assignments[current])) ||
          (s.isOpenTable && pottedBalls.length > 0);
        if (!pottedOwnGroup) {
          nextPlayer = opp;
          s.currentPlayer = opp;
        }
      }
    }

    s.ballInHand = ballInHandNext;
    s.breakInProgress = false;
    s.scores = computeScores(s.ballsOnTable, s.assignments);

    if (frameOver) {
      s.frameOver = true;
      s.winner = winner;
    }

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: pottedList,
      nextPlayer,
      ballInHandNext,
      frameOver,
      winner,
      assignments: { ...s.assignments },
      isOpenTable: s.isOpenTable,
      scores: { ...s.scores }
    };
  }
}

export default AmericanBilliards;
