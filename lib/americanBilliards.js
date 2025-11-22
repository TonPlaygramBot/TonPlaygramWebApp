export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      scores: { A: 0, B: 0 },
      ballInHand: false
    };
  }

  shotTaken (shot) {
    const s = this.state;
    const current = s.currentPlayer;
    const opp = current === 'A' ? 'B' : 'A';
    const lowest = s.ballsOnTable.size ? Math.min(...s.ballsOnTable) : null;
    let foul = false;
    let reason = '';

    const first = shot.contactOrder && shot.contactOrder[0];
    if (!foul && first !== lowest) {
      foul = true;
      reason = 'wrong first contact';
    }

    if (!foul && (shot.potted.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    const pottedBalls = shot.potted.filter(id => id !== 0);
    const points = pottedBalls.reduce((a, b) => a + b, 0);

    let nextPlayer = current;
    let ballInHandNext = false;

    if (foul) {
      s.scores[opp] += points;
      nextPlayer = opp;
      s.currentPlayer = opp;
      ballInHandNext = true;
    } else {
      for (const id of pottedBalls) s.ballsOnTable.delete(id);
      s.scores[current] += points;
      if (pottedBalls.length === 0) {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

    s.ballInHand = ballInHandNext;
    const nextBall = s.ballsOnTable.size ? Math.min(...s.ballsOnTable) : null;

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: shot.potted,
      nextPlayer,
      ballInHandNext,
      scores: { ...s.scores },
      currentBall: nextBall
    };
  }
}

export default AmericanBilliards;
