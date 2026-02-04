const SOLID_SET = new Set([1, 2, 3, 4, 5, 6, 7]);
const STRIPE_SET = new Set([9, 10, 11, 12, 13, 14, 15]);

function groupForBall (id) {
  if (id === 8) return 'black';
  if (SOLID_SET.has(id)) return 'solid';
  if (STRIPE_SET.has(id)) return 'stripe';
  return null;
}

function opponent (player) {
  return player === 'A' ? 'B' : 'A';
}

export class AmericanBilliards {
  constructor () {
    this.state = {
      ballsOnTable: {
        solids: new Set(SOLID_SET),
        stripes: new Set(STRIPE_SET),
        black8: true,
        cueInPocket: false
      },
      assignments: { A: null, B: null },
      currentPlayer: 'A',
      ballInHand: false,
      isOpenTable: true,
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
    const ownGroup = s.assignments[current];
    const firstContact = contactOrder[0] ?? null;
    const firstGroup = typeof firstContact === 'number' ? groupForBall(firstContact) : null;
    const scratched = pottedList.includes(0) || shot.cueOffTable;
    const solidsRemaining = s.ballsOnTable.solids.size;
    const stripesRemaining = s.ballsOnTable.stripes.size;
    const ownGroupRemaining =
      ownGroup === 'solid'
        ? solidsRemaining
        : ownGroup === 'stripe'
          ? stripesRemaining
          : null;
    const nonBlackRemaining = solidsRemaining + stripesRemaining;

    let foul = false;
    let reason = '';
    if (!foul && !firstContact) {
      foul = true;
      reason = 'no contact';
    }
    if (!foul && scratched) {
      foul = true;
      reason = 'scratch';
    }
    if (!foul) {
      if (s.isOpenTable || !ownGroup) {
        if (firstGroup === 'black' && nonBlackRemaining > 0) {
          foul = true;
          reason = 'contacted black early';
        }
      } else if (ownGroupRemaining != null && ownGroupRemaining > 0) {
        if (firstGroup !== ownGroup) {
          foul = true;
          reason = 'wrong first contact';
        }
      } else if (firstGroup !== 'black') {
        foul = true;
        reason = 'must hit 8 ball';
      }
    }

    const pottedSolids = pottedList.filter((id) => SOLID_SET.has(id));
    const pottedStripes = pottedList.filter((id) => STRIPE_SET.has(id));
    const blackPotted = pottedList.includes(8);
    const ownClearedBefore =
      ownGroupRemaining != null ? ownGroupRemaining === 0 : false;

    if (!foul && blackPotted && !ownClearedBefore) {
      foul = true;
      reason = 'potted black early';
    }

    let frameOver = false;
    let winner = null;
    if (blackPotted) {
      frameOver = true;
      winner = foul ? opp : current;
      s.frameOver = true;
      s.winner = winner;
    }

    if (!foul) {
      pottedSolids.forEach((id) => s.ballsOnTable.solids.delete(id));
      pottedStripes.forEach((id) => s.ballsOnTable.stripes.delete(id));
      if (blackPotted) s.ballsOnTable.black8 = false;
      if (pottedList.includes(0)) s.ballsOnTable.cueInPocket = true;
    }

    if (!foul && s.isOpenTable) {
      let assigned = null;
      if (firstGroup === 'solid' && pottedSolids.length > 0) assigned = 'solid';
      if (firstGroup === 'stripe' && pottedStripes.length > 0) assigned = 'stripe';
      if (!assigned && pottedSolids.length > 0 && pottedStripes.length === 0) {
        assigned = 'solid';
      }
      if (!assigned && pottedStripes.length > 0 && pottedSolids.length === 0) {
        assigned = 'stripe';
      }
      if (assigned) {
        s.assignments[current] = assigned;
        s.assignments[opp] = assigned === 'solid' ? 'stripe' : 'solid';
        s.isOpenTable = false;
      }
    }

    let nextPlayer = current;
    if (foul) {
      nextPlayer = opp;
      s.currentPlayer = opp;
      s.ballInHand = true;
    } else if (!frameOver) {
      const pottedOwn =
        s.isOpenTable
          ? pottedSolids.length > 0 || pottedStripes.length > 0
          : ownGroup === 'solid'
            ? pottedSolids.length > 0
            : ownGroup === 'stripe'
              ? pottedStripes.length > 0
              : false;
      if (!pottedOwn) {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
      s.ballInHand = false;
    }

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: pottedList,
      nextPlayer,
      ballInHandNext: s.ballInHand,
      frameOver,
      winner
    };
  }
}

export default AmericanBilliards;
