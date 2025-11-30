export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      scores: { A: 0, B: 0 },
      ballInHand: false,
      foulStreak: { A: 0, B: 0 },
      frameOver: false,
      winner: null
    };
  }

  shotTaken (shot) {
    const s = this.state;
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
    const points = pottedBalls.reduce((a, b) => a + b, 0);

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;
    const targetScore = 61;

    const spotPotted = () => {
      for (const id of pottedBalls) s.ballsOnTable.add(id);
    };

    if (foul) {
      s.scores[current] = Math.max(0, s.scores[current] - 1);
      s.scores[opp] += 1;
      spotPotted();
      nextPlayer = opp;
      s.currentPlayer = opp;
      ballInHandNext = true;
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1;
      s.foulStreak[opp] = 0;
    } else {
      for (const id of pottedBalls) s.ballsOnTable.delete(id);
      s.scores[current] += points;
      s.foulStreak[current] = 0;
      s.foulStreak[opp] = 0;
      if (pottedBalls.length === 0) {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

    s.ballInHand = ballInHandNext;
    const nextBall = s.ballsOnTable.size ? Math.min(...s.ballsOnTable) : null;

    if (s.scores[current] >= targetScore || s.scores[opp] >= targetScore || s.ballsOnTable.size === 0) {
      frameOver = true;
      if (s.scores[current] > s.scores[opp]) winner = current;
      else if (s.scores[opp] > s.scores[current]) winner = opp;
      else winner = 'TIE';
      s.frameOver = true;
      s.winner = winner;
    }

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: shot.potted,
      nextPlayer,
      ballInHandNext,
      scores: { ...s.scores },
      currentBall: nextBall,
      frameOver,
      winner
    };
  }
}

export default AmericanBilliards;
