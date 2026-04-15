function opponent (p) {
  return p === 'A' ? 'B' : 'A';
}

function toFiniteCount (value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export class NineBall {
  constructor (options = {}) {
    this.rules = {
      enforceThreeFoulLoss: options.enforceThreeFoulLoss !== false,
      legalBreakMinRails: Number.isFinite(options.legalBreakMinRails)
        ? Math.max(1, Math.floor(options.legalBreakMinRails))
        : 4
    };
    this.state = {
      ballsOnTable: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      currentPlayer: 'A',
      ballInHand: false,
      gameOver: false,
      winner: null,
      foulStreak: { A: 0, B: 0 },
      breakInProgress: true,
      pushOutAvailable: false,
      pushOutInProgress: false
    };
  }

  shotTaken (shot = {}) {
    const s = this.state;
    const contactOrder = Array.isArray(shot.contactOrder) ? shot.contactOrder : [];
    const pottedList = Array.isArray(shot.potted) ? shot.potted : [];

    if (s.gameOver) {
      return { legal: false, foul: true, reason: 'game over', potted: [], nextPlayer: s.currentPlayer, ballInHandNext: false, frameOver: true, winner: s.winner };
    }

    const current = s.currentPlayer;
    const opp = opponent(current);
    const lowest = s.ballsOnTable.size ? Math.min(...s.ballsOnTable) : null;
    const wasBreakShot = Boolean(s.breakInProgress);
    const isPushOutShot = Boolean(s.pushOutInProgress && shot.pushOut === true);

    let foul = false;
    let reason = '';

    const first = contactOrder[0];
    if (!first) {
      foul = true;
      reason = 'no contact';
    }

    if (!foul && !isPushOutShot && first !== lowest) {
      foul = true;
      reason = 'wrong first contact';
    }

    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    const pottedBalls = pottedList.filter(id => id !== 0);
    const railsAfterContact = toFiniteCount(shot.railsAfterContact);
    const breakObjectBallsToRail = toFiniteCount(shot.breakObjectBallsToRail);

    if (!foul && wasBreakShot) {
      const legalBreakByEvent =
        typeof shot.legalBreak === 'boolean'
          ? shot.legalBreak
          : (pottedBalls.length > 0 || breakObjectBallsToRail >= this.rules.legalBreakMinRails);
      if (!legalBreakByEvent) {
        foul = true;
        reason = 'illegal break';
      }
    }

    if (!foul && !isPushOutShot && !wasBreakShot && pottedBalls.length === 0 && railsAfterContact === 0 && shot.noCushionAfterContact) {
      foul = true;
      reason = 'no cushion';
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;

    const spotNineIfNeeded = () => {
      if (pottedBalls.includes(9)) {
        s.ballsOnTable.add(9);
      }
    };

    if (foul) {
      for (const id of pottedBalls) {
        if (id === 9) continue;
        s.ballsOnTable.delete(id);
      }
      spotNineIfNeeded();
      nextPlayer = opp;
      ballInHandNext = true;
      s.currentPlayer = opp;
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1;
      s.foulStreak[opp] = 0;
      s.pushOutAvailable = false;
      s.pushOutInProgress = false;
    } else {
      for (const id of pottedBalls) s.ballsOnTable.delete(id);
      s.foulStreak[current] = 0;
      s.foulStreak[opp] = 0;

      if (wasBreakShot && pottedBalls.includes(9)) {
        frameOver = true;
        winner = current;
      } else if (!isPushOutShot && pottedBalls.includes(9)) {
        frameOver = true;
        winner = current;
      }

      if (!frameOver) {
        if (isPushOutShot || pottedBalls.length === 0) {
          nextPlayer = opp;
          s.currentPlayer = opp;
        } else {
          nextPlayer = current;
        }
      }

      if (wasBreakShot) {
        s.pushOutAvailable = true;
        s.pushOutInProgress = Boolean(nextPlayer === current && shot.allowPushOut !== false);
      } else {
        s.pushOutAvailable = false;
        s.pushOutInProgress = false;
      }
    }

    s.ballInHand = ballInHandNext;
    if (wasBreakShot || shot.breakComplete || !s.breakInProgress) {
      s.breakInProgress = false;
      if (!wasBreakShot) s.pushOutInProgress = false;
    }

    if (!frameOver && this.rules.enforceThreeFoulLoss && s.foulStreak[current] >= 3) {
      frameOver = true;
      winner = opp;
    }

    if (frameOver) {
      s.gameOver = true;
      s.winner = winner;
      s.pushOutAvailable = false;
      s.pushOutInProgress = false;
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
      pushOutAvailable: Boolean(s.pushOutAvailable),
      pushOutInProgress: Boolean(s.pushOutInProgress)
    };
  }
}

export default NineBall;
