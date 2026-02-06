export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      ballInHand: false,
      isOpenTable: true,
      assignments: { A: null, B: null },
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
    const opp = current === 'A' ? 'B' : 'A';
    let foul = false;
    let reason = '';

    const first = contactOrder[0];
    if (!foul && !first) {
      foul = true;
      reason = 'no contact';
    }

    const solids = new Set([1, 2, 3, 4, 5, 6, 7]);
    const stripes = new Set([9, 10, 11, 12, 13, 14, 15]);
    const isSolid = (id) => solids.has(id);
    const isStripe = (id) => stripes.has(id);
    const isEight = (id) => id === 8;
    const remainingSolids = Array.from(s.ballsOnTable).filter(isSolid).length;
    const remainingStripes = Array.from(s.ballsOnTable).filter(isStripe).length;
    const assigned = s.assignments[current];
    const needsEight = assigned && (assigned === 'SOLIDS' ? remainingSolids === 0 : remainingStripes === 0);

    if (!foul && assigned) {
      if (needsEight) {
        if (first !== 8) {
          foul = true;
          reason = 'wrong first contact';
        }
      } else if (assigned === 'SOLIDS' && !isSolid(first)) {
        foul = true;
        reason = 'wrong first contact';
      } else if (assigned === 'STRIPES' && !isStripe(first)) {
        foul = true;
        reason = 'wrong first contact';
      }
    }

    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    const pottedBalls = pottedList.filter(id => id !== 0);

    if (!foul && !pottedBalls.length && shot.noCushionAfterContact) {
      foul = true;
      reason = 'no rail after contact';
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;

    const eightPotted = pottedBalls.includes(8);
    const solidPotted = pottedBalls.find(isSolid);
    const stripePotted = pottedBalls.find(isStripe);
    const firstGroupPotted = pottedBalls.find((id) => isSolid(id) || isStripe(id)) ?? null;

    if (foul && eightPotted) {
      frameOver = true;
      winner = opp;
      s.frameOver = true;
      s.winner = winner;
    } else if (!foul && eightPotted) {
      frameOver = true;
      if (s.breakInProgress) {
        winner = current;
      } else if (s.isOpenTable) {
        winner = opp;
      } else if (!needsEight) {
        winner = opp;
      } else {
        winner = current;
      }
      s.frameOver = true;
      s.winner = winner;
    }

    if (!frameOver) {
      if (foul) {
        nextPlayer = opp;
        s.currentPlayer = opp;
        ballInHandNext = true;
      } else {
        for (const id of pottedBalls) s.ballsOnTable.delete(id);
        if (s.isOpenTable && firstGroupPotted) {
          s.isOpenTable = false;
          s.assignments[current] = isSolid(firstGroupPotted) ? 'SOLIDS' : 'STRIPES';
          s.assignments[opp] = isSolid(firstGroupPotted) ? 'STRIPES' : 'SOLIDS';
        }
        if (pottedBalls.length === 0) {
          nextPlayer = opp;
          s.currentPlayer = opp;
        }
      }
    }

    s.ballInHand = ballInHandNext;
    s.breakInProgress = false;

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
