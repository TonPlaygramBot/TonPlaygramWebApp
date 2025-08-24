export const DEFAULT_RULES = {
  blackOnBreak: 're-rack',
  freeBallFirstContact: 'anyBall',
  allowCombinations: false,
  requireCushionIfNoPot: true,
  twoVisitsCarryOnBlack: false,
  stalemateTurns: 6
};

function initialBalls () {
  return {
    yellow: new Set([1, 2, 3, 4, 5, 6, 7]),
    red: new Set([1, 2, 3, 4, 5, 6, 7]),
    black8: true,
    cueInPocket: false
  };
}

function opponent (p) {
  return p === 'A' ? 'B' : 'A';
}

export class UkPool {
  constructor (rules = {}) {
    this.rules = { ...DEFAULT_RULES, ...rules };
    this.state = {
      ballsOnTable: initialBalls(),
      assignments: { A: null, B: null },
      currentPlayer: 'A',
      shotsRemaining: 1,
      freeBallAvailable: false,
      isOpenTable: true,
      lastEvent: null,
      frameOver: false,
      winner: null
    };
  }

  startBreak () {
    this.state.lastEvent = 'BREAK_START';
  }

  /**
   * @param {Object} shot
   * @param {Array<'yellow'|'red'|'black'|'cue'>} shot.contactOrder
   * @param {Array<'yellow'|'red'|'black'|'cue'>} shot.potted
   * @param {boolean} shot.cueOffTable
   * @param {boolean} shot.noCushionAfterContact
   * @param {boolean} shot.placedFromHand
   * @returns {Object} ShotResult
   */
  shotTaken (shot) {
    const s = this.state;
    if (s.frameOver) {
      return {
        legal: false,
        foul: true,
        reason: 'frame already over',
        potted: [],
        nextPlayer: s.currentPlayer,
        shotsRemainingNext: 0,
        freeBallNext: false,
        frameOver: true,
        winner: s.winner
      };
    }

    const current = s.currentPlayer;
    const opp = opponent(current);
    const ownGroup = s.assignments[current];
    const oppGroup = s.assignments[opp];
    let foul = false;
    let reason = '';

    const first = shot.contactOrder && shot.contactOrder[0];

    // no contact
    if (!first) {
      foul = true;
      reason = 'no contact';
    }

    // scratch
    if (!foul && (shot.potted.includes('cue') || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    // first contact legality
    if (!foul) {
      if (!(s.freeBallAvailable && this.rules.freeBallFirstContact === 'anyBall')) {
        if (s.isOpenTable) {
          if (first !== 'yellow' && first !== 'red') {
            foul = true;
            reason = 'wrong first contact';
          }
        } else {
          if (ownGroup && first !== ownGroup) {
            if (first === 'black') {
              foul = true;
              reason = 'contacted black early';
            } else {
              foul = true;
              reason = 'wrong first contact';
            }
          }
          if (!ownGroup && (first === 'black')) {
            foul = true;
            reason = 'contacted black early';
          }
        }
      } else if (this.rules.freeBallFirstContact === 'ownOnly' && ownGroup && first !== ownGroup) {
        foul = true;
        reason = 'wrong first contact';
      }
    }

    // no cushion after contact
    if (!foul && shot.potted.length === 0 && shot.noCushionAfterContact && this.rules.requireCushionIfNoPot) {
      foul = true;
      reason = 'no cushion';
    }

    // potting opponent ball illegally
    if (!foul && oppGroup && shot.potted.includes(oppGroup) && !(s.freeBallAvailable && this.rules.freeBallFirstContact === 'anyBall')) {
      foul = true;
      reason = 'potted opponent ball';
    }

    // potting black
    let blackPotted = shot.potted.includes('black');
    if (!foul && blackPotted) {
      // can only pot black if own group cleared
      const ownSet = ownGroup ? s.ballsOnTable[ownGroup] : null;
      const hasOwn = ownSet && ownSet.size > 0;
      if (hasOwn || s.isOpenTable) {
        foul = true;
        reason = 'potted black early';
      }
    }

    // apply pot removals
    if (!foul) {
      shot.potted.forEach(col => {
        if (col === 'yellow' || col === 'red') {
          const set = s.ballsOnTable[col];
          const id = set.values().next().value;
          if (id !== undefined) set.delete(id);
        } else if (col === 'black') {
          s.ballsOnTable.black8 = false;
        } else if (col === 'cue') {
          s.ballsOnTable.cueInPocket = true;
        }
      });
    }

    // group assignment on open table
    if (!foul && s.isOpenTable) {
      const colors = new Set(shot.potted.filter(c => c === 'yellow' || c === 'red'));
      if (colors.size === 1) {
        const chosen = [...colors][0];
        s.assignments[current] = chosen;
        s.assignments[opp] = chosen === 'yellow' ? 'red' : 'yellow';
        s.isOpenTable = false;
      }
    }

    // post-shot updates
    let nextPlayer = current;
    let shotsNext = s.shotsRemaining;
    let freeNext = false;
    let frameOver = false;
    let winner = null;

    if (foul) {
      nextPlayer = opp;
      shotsNext = 2;
      freeNext = true;
      s.currentPlayer = nextPlayer;
      s.shotsRemaining = shotsNext;
      s.freeBallAvailable = true;
      s.lastEvent = 'FOUL';
      if (blackPotted) {
        frameOver = true;
        winner = opp;
        s.frameOver = true;
        s.winner = winner;
      }
    } else {
      s.freeBallAvailable = false;
      // check 8-ball legal pot
      if (blackPotted) {
        frameOver = true;
        winner = current;
        s.frameOver = true;
        s.winner = winner;
        s.lastEvent = 'FRAME_END';
        return {
          legal: true,
          foul: false,
          potted: shot.potted,
          nextPlayer: current,
          shotsRemainingNext: 0,
          freeBallNext: false,
          frameOver: true,
          winner
        };
      }

      const potOwn = ownGroup && shot.potted.includes(ownGroup);
      if (!potOwn) {
        shotsNext = s.shotsRemaining - 1;
      }
      if (shotsNext <= 0) {
        nextPlayer = opp;
        shotsNext = 1;
      }
      s.currentPlayer = nextPlayer;
      s.shotsRemaining = shotsNext;
      s.lastEvent = 'SHOT_TAKEN';
    }

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      potted: shot.potted,
      nextPlayer,
      shotsRemainingNext: shotsNext,
      freeBallNext: freeNext,
      frameOver,
      winner: frameOver ? winner : undefined
    };
  }
}

export default UkPool;
