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
    const lowest = lowestBall(s.ballsOnTable);
    if (!foul && !first) {
      foul = true;
      reason = 'no contact';
    }
    if (!foul && lowest != null && first !== lowest) {
      foul = true;
      reason = 'wrong first contact';
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

    const pottedObjectBalls = pottedBalls.slice();

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

    if (!foul && pottedObjectBalls.length > 0) {
      const earned = pottedObjectBalls.reduce((sum, id) => sum + (Number(id) || 0), 0);
      s.scores[current] = (s.scores[current] ?? 0) + earned;
    }
    if (s.ballsOnTable.size === 0) {
      frameOver = true;
      if (s.scores.A > s.scores.B) winner = 'A';
      else if (s.scores.B > s.scores.A) winner = 'B';
      else winner = 'TIE';
    }

    if (!frameOver) {
      if (foul) {
        nextPlayer = opp;
      } else if (pottedObjectBalls.length > 0) {
        nextPlayer = current;
      } else {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

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

function lowestBall (balls) {
  let lowest = null;
  for (const id of balls) {
    if (lowest == null || id < lowest) lowest = id;
  }
  return lowest;
}
