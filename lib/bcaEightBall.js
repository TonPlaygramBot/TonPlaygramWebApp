function opponent(player) {
  return player === 'A' ? 'B' : 'A';
}

function groupForBall(ballId) {
  if (ballId >= 1 && ballId <= 7) return 'SOLID';
  if (ballId >= 9 && ballId <= 15) return 'STRIPE';
  return null;
}

function remainingGroupBalls(ballsOnTable, group) {
  if (!group) return 0;
  let remaining = 0;
  for (const id of ballsOnTable) {
    if (groupForBall(id) === group) remaining += 1;
  }
  return remaining;
}

export class BcaEightBall {
  constructor() {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      assignments: { A: null, B: null },
      ballInHand: false,
      frameOver: false,
      winner: null,
      breakInProgress: true
    };
  }

  shotTaken(shot = {}) {
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

    const shooter = s.currentPlayer;
    const other = opponent(shooter);
    const objectPotted = pottedList.filter((id) => id !== 0 && id >= 1 && id <= 15);
    const first = Number.isFinite(contactOrder[0]) ? contactOrder[0] : (objectPotted[0] ?? null);
    const cueScratched = pottedList.includes(0) || Boolean(shot.cueOffTable);
    const shooterGroup = s.assignments[shooter];
    const shooterGroupRemaining = remainingGroupBalls(s.ballsOnTable, shooterGroup);
    const eightLegallyOn = Boolean(shooterGroup && shooterGroupRemaining === 0);
    const firstContactGroup = Number.isFinite(first) ? groupForBall(first) : null;

    let foul = false;
    let reason = '';

    if (!first) {
      foul = true;
      reason = 'no contact';
    } else if (shooterGroup) {
      if (eightLegallyOn) {
        if (first !== 8) {
          foul = true;
          reason = 'wrong first contact';
        }
      } else if (firstContactGroup !== shooterGroup) {
        foul = true;
        reason = 'wrong first contact';
      }
    } else if (first === 8) {
      foul = true;
      reason = 'wrong first contact';
    }

    if (!foul && cueScratched) {
      foul = true;
      reason = 'scratch';
    }

    if (!foul && shot.noCushionAfterContact && objectPotted.length === 0) {
      foul = true;
      reason = 'no cushion';
    }

    const pottedEight = objectPotted.includes(8);
    if (!foul && pottedEight && !eightLegallyOn) {
      foul = true;
      reason = 'potted black early';
    }

    let frameOver = false;
    let winner = null;
    let nextPlayer = shooter;
    let ballInHandNext = false;

    if (foul) {
      for (const id of objectPotted) {
        if (id !== 8) s.ballsOnTable.delete(id);
      }
      if (pottedEight) {
        frameOver = true;
        winner = other;
      } else {
        nextPlayer = other;
        s.currentPlayer = other;
        ballInHandNext = true;
      }
    } else {
      for (const id of objectPotted) {
        s.ballsOnTable.delete(id);
      }
      if (!shooterGroup) {
        const groupsPotted = new Set(objectPotted.map((id) => groupForBall(id)).filter(Boolean));
        if (groupsPotted.size === 1) {
          const chosen = groupsPotted.has('SOLID') ? 'SOLID' : 'STRIPE';
          s.assignments[shooter] = chosen;
          s.assignments[other] = chosen === 'SOLID' ? 'STRIPE' : 'SOLID';
        }
      }
      if (pottedEight) {
        frameOver = true;
        winner = shooter;
      } else {
        const activeGroup = s.assignments[shooter];
        const scoredOwnGroup =
          objectPotted.some((id) => groupForBall(id) === activeGroup) ||
          (!activeGroup && objectPotted.some((id) => id !== 8));
        if (!scoredOwnGroup) {
          nextPlayer = other;
          s.currentPlayer = other;
        }
      }
    }

    s.ballInHand = ballInHandNext;
    if (s.breakInProgress) s.breakInProgress = false;
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

export default BcaEightBall;
