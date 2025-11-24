function opponent (p) {
  return p === 'A' ? 'B' : 'A';
}

export class NineBall {
  constructor () {
    this.state = {
      ballsOnTable: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      currentPlayer: 'A',
      ballInHand: false,
      gameOver: false,
      winner: null,
      foulStreak: { A: 0, B: 0 }
    };
  }

  shotTaken (shot) {
    const s = this.state;
    if (s.gameOver) {
      return { legal: false, foul: true, reason: 'game over', potted: [], nextPlayer: s.currentPlayer, ballInHandNext: false, frameOver: true, winner: s.winner };
    }
    const current = s.currentPlayer;
    const opp = opponent(current);
    const lowest = s.ballsOnTable.size ? Math.min(...s.ballsOnTable) : null;
    let foul = false;
    let reason = '';

    const first = shot.contactOrder && shot.contactOrder[0];
    if (!foul && !first) {
      foul = true;
      reason = 'no contact';
    }

    if (!foul && first !== lowest) {
      foul = true;
      reason = 'wrong first contact';
    }

    if (!foul && (shot.potted.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    if (!foul && shot.noCushionAfterContact && shot.potted.length === 0) {
      foul = true;
      reason = 'no cushion';
    }

    const pottedBalls = shot.potted.filter(id => id !== 0);

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;
    const foulLimit = 3;

    if (foul) {
      nextPlayer = opp;
      ballInHandNext = true;
      s.currentPlayer = opp;
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1;
      s.foulStreak[opp] = 0;
    } else {
      for (const id of pottedBalls) s.ballsOnTable.delete(id);
      s.foulStreak[current] = 0;
      s.foulStreak[opp] = 0;
      if (pottedBalls.includes(9)) {
        frameOver = true;
        winner = current;
        s.gameOver = true;
        s.winner = winner;
      }
      if (frameOver) {
        nextPlayer = current;
      } else if (pottedBalls.length === 0) {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

    s.ballInHand = ballInHandNext;

    if (!frameOver && s.foulStreak[current] >= foulLimit) {
      frameOver = true;
      winner = opp;
      s.gameOver = true;
      s.winner = winner;
    }

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: shot.potted,
      nextPlayer,
      ballInHandNext,
      frameOver,
      winner
    };
  }
}

export default NineBall;
