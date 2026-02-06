const SOLIDS = new Set([1, 2, 3, 4, 5, 6, 7]);
const STRIPES = new Set([9, 10, 11, 12, 13, 14, 15]);

function opponent (p) {
  return p === 'A' ? 'B' : 'A';
}

function groupForBall (id) {
  if (SOLIDS.has(id)) return 'SOLIDS';
  if (STRIPES.has(id)) return 'STRIPES';
  return null;
}

function remainingForGroup (ballsOnTable, group) {
  if (!group) return 0;
  if (group === 'SOLIDS') {
    return Array.from(ballsOnTable).filter(id => SOLIDS.has(id)).length;
  }
  if (group === 'STRIPES') {
    return Array.from(ballsOnTable).filter(id => STRIPES.has(id)).length;
  }
  return 0;
}

export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      ballInHand: false,
      assignments: { A: null, B: null },
      isOpenTable: true,
      breakInProgress: true,
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
        winner: s.winner
      };
    }

    const current = s.currentPlayer;
    const opp = opponent(current);
    const first = contactOrder[0];
    const pottedBalls = pottedList.filter(id => id !== 0);
    const eightPotted = pottedBalls.includes(8);
    let foul = false;
    let reason = '';

    if (!first) {
      foul = true;
      reason = 'no contact';
    }

    if (!foul && s.isOpenTable && first === 8) {
      foul = true;
      reason = 'illegal 8-ball contact';
    }

    if (!foul && !s.isOpenTable) {
      const assignment = s.assignments[current];
      const remaining = remainingForGroup(s.ballsOnTable, assignment);
      if (remaining > 0) {
        if (groupForBall(first) !== assignment) {
          foul = true;
          reason = 'wrong first contact';
        }
      } else if (first !== 8) {
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
      reason = 'no rail';
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;
    const wasBreak = Boolean(s.breakInProgress);

    if (eightPotted && !wasBreak) {
      const assignment = s.assignments[current];
      const remaining = remainingForGroup(s.ballsOnTable, assignment);
      if (foul || s.isOpenTable || remaining > 0) {
        frameOver = true;
        winner = opp;
      } else {
        frameOver = true;
        winner = current;
      }
    }

    if (foul && eightPotted && !wasBreak) {
      frameOver = true;
      winner = opp;
    }

    if (foul) {
      nextPlayer = opp;
      ballInHandNext = true;
      s.currentPlayer = opp;
    }

    if (!frameOver) {
      if (wasBreak && eightPotted) {
        s.ballsOnTable.add(8);
      }
      for (const id of pottedBalls) {
        if (id === 8 && wasBreak) continue;
        s.ballsOnTable.delete(id);
      }
    }

    if (!frameOver && !foul && !wasBreak && s.isOpenTable) {
      const firstGroupBall = pottedBalls.find(id => groupForBall(id));
      if (firstGroupBall) {
        const group = groupForBall(firstGroupBall);
        s.assignments[current] = group;
        s.assignments[opp] = group === 'SOLIDS' ? 'STRIPES' : 'SOLIDS';
        s.isOpenTable = false;
      }
    }

    if (
      !frameOver &&
      !foul &&
      pottedBalls.filter(id => id !== 8).length === 0 &&
      !(wasBreak && eightPotted)
    ) {
      nextPlayer = opp;
      s.currentPlayer = opp;
    }

    if (wasBreak) {
      s.breakInProgress = false;
      s.isOpenTable = true;
    }

    s.ballInHand = ballInHandNext;
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
