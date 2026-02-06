function opponent (player) {
  return player === 'A' ? 'B' : 'A';
}

function isSolid (id) {
  return id >= 1 && id <= 7;
}

function isStripe (id) {
  return id >= 9 && id <= 15;
}

function isEight (id) {
  return id === 8;
}

function groupFromBall (id) {
  if (isSolid(id)) return 'solids';
  if (isStripe(id)) return 'stripes';
  return null;
}

export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      assignments: { A: null, B: null },
      isOpenTable: true,
      ballInHand: false,
      foulStreak: { A: 0, B: 0 },
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
    const pottedSolids = pottedBalls.filter(isSolid);
    const pottedStripes = pottedBalls.filter(isStripe);
    const pottedEight = pottedBalls.some(isEight);
    const assignedGroup = s.assignments[current];
    const groupRemaining = (group) => Array.from(s.ballsOnTable).some(id => groupFromBall(id) === group);
    const onEight = assignedGroup && !groupRemaining(assignedGroup);

    let foul = false;
    let reason = '';
    let immediateLoss = false;

    if (!first) {
      foul = true;
      reason = 'no contact';
    }

    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    if (!foul) {
      if (s.isOpenTable) {
        if (isEight(first)) {
          foul = true;
          reason = 'wrong first contact';
        }
      } else if (assignedGroup) {
        if (onEight) {
          if (!isEight(first)) {
            foul = true;
            reason = 'wrong first contact';
          }
        } else if (groupFromBall(first) !== assignedGroup) {
          foul = true;
          reason = 'wrong first contact';
        }
      }
    }

    if (!foul && pottedBalls.length === 0 && shot.noCushionAfterContact) {
      foul = true;
      reason = 'no rail after contact';
    }

    if (pottedEight) {
      if (foul) {
        immediateLoss = true;
      } else if (s.isOpenTable || !onEight) {
        immediateLoss = true;
      }
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;

    if (immediateLoss) {
      frameOver = true;
      winner = opp;
      s.frameOver = true;
      s.winner = winner;
      s.currentPlayer = opp;
      return {
        legal: false,
        foul: true,
        reason: 'illegal 8-ball',
        potted: pottedList,
        nextPlayer: opp,
        ballInHandNext: false,
        frameOver,
        winner
      };
    }

    if (foul) {
      nextPlayer = opp;
      s.currentPlayer = opp;
      ballInHandNext = true;
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1;
      s.foulStreak[opp] = 0;
      for (const id of pottedBalls) {
        if (!isEight(id)) s.ballsOnTable.delete(id);
      }
    } else {
      for (const id of pottedBalls) s.ballsOnTable.delete(id);
      s.foulStreak[current] = 0;
      s.foulStreak[opp] = 0;
      if (s.isOpenTable) {
        const pottedGroups = new Set();
        if (pottedSolids.length) pottedGroups.add('solids');
        if (pottedStripes.length) pottedGroups.add('stripes');
        if (pottedGroups.size === 1) {
          const group = pottedSolids.length ? 'solids' : 'stripes';
          s.assignments[current] = group;
          s.assignments[opp] = group === 'solids' ? 'stripes' : 'solids';
          s.isOpenTable = false;
        }
      }
      if (pottedBalls.length === 0) {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

    if (!frameOver && pottedEight && !immediateLoss) {
      frameOver = true;
      winner = current;
      s.frameOver = true;
      s.winner = winner;
    }

    s.ballInHand = ballInHandNext;

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
