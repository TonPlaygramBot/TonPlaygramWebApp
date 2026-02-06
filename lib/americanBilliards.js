export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      ballInHand: false,
      foulStreak: { A: 0, B: 0 },
      frameOver: false,
      winner: null,
      assignments: { A: null, B: null },
      isOpenTable: true,
      breakInProgress: true,
      scores: { A: 0, B: 0 }
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
    const assignments = s.assignments ?? { A: null, B: null };
    s.assignments = assignments;
    const groupForBall = (id) => {
      if (id >= 1 && id <= 7) return 'solids';
      if (id >= 9 && id <= 15) return 'stripes';
      return null;
    };
    const remainingCount = (group) => {
      if (!group) return 0;
      let count = 0;
      for (const id of s.ballsOnTable) {
        if (groupForBall(id) === group) count += 1;
      }
      return count;
    };

    const first = contactOrder[0];
    if (!foul && !first) {
      foul = true;
      reason = 'no contact';
    }

    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    const pottedBalls = pottedList.filter(id => id !== 0);
    const pottedGroups = new Set(pottedBalls.map((id) => groupForBall(id)).filter(Boolean));
    const pottedEight = pottedBalls.includes(8);
    const openTable = Boolean(s.isOpenTable);
    const assignedGroup = assignments[current];
    const ownRemaining = assignedGroup ? remainingCount(assignedGroup) : 0;

    if (!foul && openTable && first === 8) {
      foul = true;
      reason = 'illegal first contact';
    }

    if (!foul && !openTable && assignedGroup) {
      if (ownRemaining > 0 && groupForBall(first) !== assignedGroup) {
        foul = true;
        reason = 'wrong first contact';
      }
      if (ownRemaining === 0 && first !== 8) {
        foul = true;
        reason = 'wrong first contact';
      }
    }

    if (!foul && shot.noCushionAfterContact && pottedBalls.length === 0) {
      foul = true;
      reason = 'no rail';
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;

    if (foul) {
      if (pottedEight) {
        frameOver = true;
        winner = opp;
        s.frameOver = true;
        s.winner = winner;
      }
      for (const id of pottedBalls) {
        if (id !== 8) s.ballsOnTable.delete(id);
      }
      nextPlayer = opp;
      s.currentPlayer = opp;
      ballInHandNext = true;
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1;
      s.foulStreak[opp] = 0;
    } else {
      for (const id of pottedBalls) s.ballsOnTable.delete(id);
      s.foulStreak[current] = 0;
      s.foulStreak[opp] = 0;
      if (openTable && pottedGroups.size === 1 && !pottedEight) {
        const resolved = Array.from(pottedGroups)[0];
        assignments[current] = resolved;
        assignments[opp] = resolved === 'solids' ? 'stripes' : 'solids';
        s.isOpenTable = false;
      }
    }

    s.ballInHand = ballInHandNext;

    if (!frameOver && pottedEight) {
      if (foul) {
        frameOver = true;
        winner = opp;
      } else if (s.breakInProgress) {
        frameOver = true;
        winner = current;
      } else if (s.isOpenTable || ownRemaining > 0) {
        frameOver = true;
        winner = opp;
      } else {
        frameOver = true;
        winner = current;
      }
      s.frameOver = true;
      s.winner = winner;
    }

    if (!frameOver && !foul) {
      const activeAssignment = s.assignments?.[current] ?? null;
      const keepTurn = s.isOpenTable
        ? pottedBalls.some((id) => id !== 8)
        : activeAssignment
          ? pottedBalls.some((id) => groupForBall(id) === activeAssignment)
          : false;
      if (!keepTurn) {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

    if (s.breakInProgress) {
      s.breakInProgress = false;
    }

    const updateScores = () => {
      const solidsRemaining = remainingCount('solids');
      const stripesRemaining = remainingCount('stripes');
      const solidsPotted = 7 - solidsRemaining;
      const stripesPotted = 7 - stripesRemaining;
      s.scores.A = assignments.A === 'solids' ? solidsPotted : assignments.A === 'stripes' ? stripesPotted : 0;
      s.scores.B = assignments.B === 'solids' ? solidsPotted : assignments.B === 'stripes' ? stripesPotted : 0;
    };
    updateScores();

    if (!frameOver && s.ballsOnTable.size === 0) {
      frameOver = true;
      winner = current;
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
      scores: { ...s.scores },
      frameOver,
      winner,
      assignments: { ...assignments },
      isOpenTable: s.isOpenTable
    };
  }
}

export default AmericanBilliards;
