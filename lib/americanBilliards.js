const TOTALS = Object.freeze({ SOLID: 7, STRIPE: 7 });

function opponent (seat) {
  return seat === 'A' ? 'B' : 'A';
}

function ballGroup (id) {
  if (id === 8) return 'EIGHT';
  if (id >= 1 && id <= 7) return 'SOLID';
  if (id >= 9 && id <= 15) return 'STRIPE';
  return null;
}

function remainingGroup (ballsOnTable, group) {
  if (!group) return 0;
  let count = 0;
  for (const id of ballsOnTable) {
    if (ballGroup(id) === group) count += 1;
  }
  return count;
}

function computeScores (state) {
  const remainingSolids = remainingGroup(state.ballsOnTable, 'SOLID');
  const remainingStripes = remainingGroup(state.ballsOnTable, 'STRIPE');
  return {
    A: state.assignments.A === 'SOLID'
      ? TOTALS.SOLID - remainingSolids
      : state.assignments.A === 'STRIPE'
        ? TOTALS.STRIPE - remainingStripes
        : 0,
    B: state.assignments.B === 'SOLID'
      ? TOTALS.SOLID - remainingSolids
      : state.assignments.B === 'STRIPE'
        ? TOTALS.STRIPE - remainingStripes
        : 0
  };
}

export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      assignments: { A: null, B: null },
      isOpenTable: true,
      scores: { A: 0, B: 0 },
      ballInHand: false,
      foulStreak: { A: 0, B: 0 },
      frameOver: false,
      winner: null,
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
    const opp = opponent(current);
    let foul = false;
    let reason = '';

    const first = contactOrder[0];
    if (!foul && !first) {
      foul = true;
      reason = 'no contact';
    }

    const firstGroup = ballGroup(first);
    if (!foul) {
      if (s.isOpenTable) {
        if (firstGroup === 'EIGHT') {
          foul = true;
          reason = '8-ball contacted first on open table';
        }
      } else {
        const assignment = s.assignments[current];
        const remaining = remainingGroup(s.ballsOnTable, assignment);
        const onEight = remaining === 0;
        if (onEight) {
          if (first !== 8) {
            foul = true;
            reason = 'must contact 8-ball first';
          }
        } else if (assignment === 'SOLID' && firstGroup !== 'SOLID') {
          foul = true;
          reason = 'wrong first contact';
        } else if (assignment === 'STRIPE' && firstGroup !== 'STRIPE') {
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
    const eightPotted = pottedBalls.includes(8);

    if (!foul && shot.noCushionAfterContact && pottedBalls.length === 0) {
      foul = true;
      reason = 'no rail after contact';
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;
    const wasBreak = Boolean(s.breakInProgress);

    if (foul) {
      for (const id of pottedBalls) {
        if (id !== 8) s.ballsOnTable.delete(id);
      }
      if (eightPotted && !wasBreak) {
        frameOver = true;
        winner = opp;
        s.frameOver = true;
        s.winner = winner;
      } else if (eightPotted && wasBreak) {
        s.ballsOnTable.add(8);
      }
      nextPlayer = opp;
      s.currentPlayer = opp;
      ballInHandNext = true;
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1;
      s.foulStreak[opp] = 0;
    } else {
      for (const id of pottedBalls) s.ballsOnTable.delete(id);
      if (s.isOpenTable) {
        const firstGroupPotted = pottedBalls
          .map((id) => ballGroup(id))
          .find((group) => group === 'SOLID' || group === 'STRIPE');
        if (firstGroupPotted) {
          s.assignments[current] = firstGroupPotted;
          s.assignments[opp] = firstGroupPotted === 'SOLID' ? 'STRIPE' : 'SOLID';
          s.isOpenTable = false;
        }
      }
      const assignment = s.assignments[current];
      const remaining = remainingGroup(s.ballsOnTable, assignment);
      if (eightPotted) {
        if (wasBreak) {
          frameOver = true;
          winner = current;
        } else if (!assignment || remaining > 0) {
          frameOver = true;
          winner = opp;
        } else {
          frameOver = true;
          winner = current;
        }
        s.frameOver = true;
        s.winner = winner;
      }
      if (!frameOver) {
        const keepsTurn = pottedBalls.some((id) => {
          const group = ballGroup(id);
          if (group === 'EIGHT') return false;
          if (s.isOpenTable) return true;
          return assignment && group === assignment;
        });
        if (!keepsTurn) {
          nextPlayer = opp;
          s.currentPlayer = opp;
        }
      }
      s.foulStreak[current] = 0;
      s.foulStreak[opp] = 0;
    }

    s.ballInHand = ballInHandNext;
    s.breakInProgress = false;
    s.scores = computeScores(s);

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: pottedList,
      nextPlayer,
      ballInHandNext,
      scores: { ...s.scores },
      frameOver,
      winner
    };
  }
}

export default AmericanBilliards;
