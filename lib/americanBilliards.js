export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      scores: { A: 0, B: 0 },
      ballInHand: false,
      foulStreak: { A: 0, B: 0 },
      frameOver: false,
      winner: null,
      assignments: { A: null, B: null },
      isOpenTable: true,
      breakInProgress: true
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
        winner: s.winner
      };
    }
    const current = s.currentPlayer;
    const opp = current === 'A' ? 'B' : 'A';
    let foul = false;
    let reason = '';

    const first = contactOrder[0];
    if (!foul && !first) {
      foul = true;
      reason = 'no contact';
    }

    const solidsRemaining = countGroupRemaining(s.ballsOnTable, 'SOLIDS');
    const stripesRemaining = countGroupRemaining(s.ballsOnTable, 'STRIPES');
    const currentGroup = s.assignments[current];
    if (!foul) {
      if (s.isOpenTable) {
        if (first === 8) {
          foul = true;
          reason = 'wrong first contact';
        }
      } else if (currentGroup === 'SOLIDS') {
        if (solidsRemaining > 0) {
          if (!SOLIDS.has(first)) {
            foul = true;
            reason = 'wrong first contact';
          }
        } else if (first !== 8) {
          foul = true;
          reason = 'wrong first contact';
        }
      } else if (currentGroup === 'STRIPES') {
        if (stripesRemaining > 0) {
          if (!STRIPES.has(first)) {
            foul = true;
            reason = 'wrong first contact';
          }
        } else if (first !== 8) {
          foul = true;
          reason = 'wrong first contact';
        }
      }
    }

    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    const pottedBalls = pottedList.filter(id => id !== 0);
    if (!foul && shot.noCushionAfterContact && pottedBalls.length === 0) {
      foul = true;
      reason = 'no cushion';
    }

    const eightPotted = pottedBalls.includes(8);
    const pottedObjectBalls = pottedBalls.filter((id) => id !== 8);

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;

    if (foul) {
      nextPlayer = opp;
      s.currentPlayer = opp;
      ballInHandNext = true;
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1;
      s.foulStreak[opp] = 0;
    }
    if (!foul) {
      s.foulStreak[current] = 0;
      s.foulStreak[opp] = 0;
    }

    for (const id of pottedObjectBalls) s.ballsOnTable.delete(id);

    if (eightPotted) {
      if (s.breakInProgress) {
        s.ballsOnTable.add(8);
      } else if (foul || s.isOpenTable) {
        frameOver = true;
        winner = opp;
      } else {
        const groupRemaining =
          currentGroup === 'SOLIDS'
            ? countGroupRemaining(s.ballsOnTable, 'SOLIDS')
            : countGroupRemaining(s.ballsOnTable, 'STRIPES');
        if (currentGroup && groupRemaining === 0) {
          frameOver = true;
          winner = current;
          s.ballsOnTable.delete(8);
        } else {
          frameOver = true;
          winner = opp;
        }
      }
    }

    if (!foul && s.isOpenTable) {
      const firstAssigned = pottedList.find((id) => id !== 0 && id !== 8);
      const assignedGroup = groupForBall(firstAssigned);
      if (assignedGroup === 'SOLIDS' || assignedGroup === 'STRIPES') {
        s.assignments[current] = assignedGroup;
        s.assignments[opp] = assignedGroup === 'SOLIDS' ? 'STRIPES' : 'SOLIDS';
        s.isOpenTable = false;
      }
    }

    if (!frameOver) {
      if (foul) {
        nextPlayer = opp;
      } else if (pottedObjectBalls.length > 0 || (eightPotted && s.breakInProgress)) {
        nextPlayer = current;
      } else {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

    s.scores = computeScores(s.ballsOnTable, s.assignments);

    s.ballInHand = ballInHandNext;
    s.breakInProgress = false;
    s.frameOver = frameOver;
    s.winner = winner;

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: pottedList,
      nextPlayer,
      ballInHandNext,
      frameOver,
      winner
    };
  }
}

export default AmericanBilliards;

const SOLIDS = new Set([1, 2, 3, 4, 5, 6, 7]);
const STRIPES = new Set([9, 10, 11, 12, 13, 14, 15]);
const TOTAL_GROUP_BALLS = 7;

function groupForBall (id) {
  if (SOLIDS.has(id)) return 'SOLIDS';
  if (STRIPES.has(id)) return 'STRIPES';
  return null;
}

function countGroupRemaining (balls, group) {
  let count = 0;
  if (group === 'SOLIDS') {
    for (const id of SOLIDS) {
      if (balls.has(id)) count += 1;
    }
  } else if (group === 'STRIPES') {
    for (const id of STRIPES) {
      if (balls.has(id)) count += 1;
    }
  }
  return count;
}

function computeScores (balls, assignments) {
  const solidsRemaining = countGroupRemaining(balls, 'SOLIDS');
  const stripesRemaining = countGroupRemaining(balls, 'STRIPES');
  return {
    A: assignments.A === 'SOLIDS' ? TOTAL_GROUP_BALLS - solidsRemaining : assignments.A === 'STRIPES' ? TOTAL_GROUP_BALLS - stripesRemaining : 0,
    B: assignments.B === 'SOLIDS' ? TOTAL_GROUP_BALLS - solidsRemaining : assignments.B === 'STRIPES' ? TOTAL_GROUP_BALLS - stripesRemaining : 0
  };
}
