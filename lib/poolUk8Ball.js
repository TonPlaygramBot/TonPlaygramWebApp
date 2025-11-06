export const DEFAULT_RULES = {
  blackOnBreak: 're-rack',
  allowCombinations: false,
  requireCushionIfNoPot: true,
  twoVisitsCarryOnBlack: false,
  stalemateTurns: 6
};

function initialBalls () {
  return {
    blue: new Set([1, 2, 3, 4, 5, 6, 7]),
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
      isOpenTable: true,
      lastEvent: null,
      frameOver: false,
      winner: null,
      mustPlayFromBaulk: false
    };
  }

  startBreak () {
    this.state.lastEvent = 'BREAK_START';
  }

  /**
   * @param {Object} shot
   * @param {Array<'blue'|'red'|'black'|'cue'>} shot.contactOrder
   * @param {Array<'blue'|'red'|'black'|'cue'>} shot.potted
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
        foul: false,
        reason: 'frame already over',
        potted: [],
        nextPlayer: s.currentPlayer,
        shotsRemainingNext: 0,
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
    const isBreak = s.lastEvent === 'BREAK_START' || s.lastEvent === null;

    const mustBaulk = s.mustPlayFromBaulk;
    s.mustPlayFromBaulk = false;
    if (mustBaulk && !shot.placedFromHand) {
      foul = true;
      reason = 'must play from baulk';
    }

    // no contact
    if (!foul && !first) {
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
      if (s.isOpenTable) {
        const bothColours =
          s.ballsOnTable.blue.size > 0 && s.ballsOnTable.red.size > 0;
        if (first === 'black' && !bothColours) {
          // allowed: one colour already cleared
        } else if (first !== 'blue' && first !== 'red') {
          foul = true;
          reason = 'wrong first contact';
        }
      } else {
        if (ownGroup && first !== ownGroup) {
          if (first === 'black') {
            const ownSet = s.ballsOnTable[ownGroup];
            if (ownSet.size > 0) {
              foul = true;
              reason = 'contacted black early';
            }
          } else {
            foul = true;
            reason = 'wrong first contact';
          }
        }
        if (!ownGroup && first === 'black') {
          foul = true;
          reason = 'contacted black early';
        }
      }
    }

    // Open table pot must match first contact after break
    if (!foul && s.isOpenTable && !isBreak) {
      const pottedColors = shot.potted.filter(c => c === 'blue' || c === 'red');
      if (pottedColors.length > 0) {
        const unique = [...new Set(pottedColors)];
        if (unique.length > 1 || unique[0] !== first) {
          foul = true;
          reason = 'wrong ball potted';
        }
      }
    }

    // no cushion after contact
    if (!foul && shot.potted.length === 0 && shot.noCushionAfterContact && this.rules.requireCushionIfNoPot) {
      foul = true;
      reason = 'no cushion';
    }

    // potting opponent ball illegally
    if (!foul && oppGroup && shot.potted.includes(oppGroup)) {
      foul = true;
      reason = 'potted opponent ball';
    }

    // potting black
    let blackPotted = shot.potted.includes('black');
    if (!foul && blackPotted) {
      // can only pot black if own group cleared
      const ownSet = ownGroup ? s.ballsOnTable[ownGroup] : null;
      const hasOwn = ownSet && ownSet.size > 0;
      // On an open table, potting the black is only a foul if both
      // colours remain. If one set is already cleared we implicitly
      // treat the remaining colour as the player's group.
      const openIllegal =
        s.isOpenTable &&
        s.ballsOnTable.blue.size > 0 &&
        s.ballsOnTable.red.size > 0;
      if (hasOwn || openIllegal) {
        foul = true;
        reason = 'potted black early';
      }
    }

    // apply pot removals
    if (!foul) {
      shot.potted.forEach(col => {
        if (col === 'blue' || col === 'red') {
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
    let choiceRequired = false;
    if (!foul && s.isOpenTable) {
      const colors = new Set(shot.potted.filter(c => c === 'blue' || c === 'red'));
      if (colors.size === 1) {
        const chosen = [...colors][0];
        s.assignments[current] = chosen;
        s.assignments[opp] = chosen === 'blue' ? 'red' : 'blue';
        s.isOpenTable = false;
      } else if (colors.size === 2) {
        choiceRequired = true;
        s.lastEvent = 'CHOICE_REQUIRED';
      }
    }

    const groupAfter = s.assignments[current];

    // when a colour choice is required (potted both colours on an open table)
    // the same player keeps the table until they pick a group. Previously we
    // allowed play to pass to the opponent which effectively stalled the
    // frame because no-one could confirm the selection. Keep the visits count
    // and let the shooter continue instead.
    if (!foul && choiceRequired) {
      const shotsNext = Math.max(1, s.shotsRemaining);
      s.currentPlayer = current;
      s.shotsRemaining = shotsNext;
      return {
        legal: true,
        foul: false,
        potted: shot.potted,
        nextPlayer: current,
        shotsRemainingNext: shotsNext,
        choiceRequired: true,
        frameOver: false
      };
    }

    // post-shot updates
    let nextPlayer = current;
    let shotsNext = s.shotsRemaining;
    let frameOver = false;
    let winner = null;

    if (foul) {
      nextPlayer = opp;
      shotsNext = 2;
      s.currentPlayer = nextPlayer;
      s.shotsRemaining = shotsNext;
      s.mustPlayFromBaulk = true;
      s.lastEvent = 'FOUL';
      if (blackPotted) {
        frameOver = true;
        winner = opp;
        s.frameOver = true;
        s.winner = winner;
      }
    } else {
      // free ball option removed
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
          frameOver: true,
          winner
        };
      }

      const potOwn = groupAfter && shot.potted.includes(groupAfter);
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
      choiceRequired,
      frameOver,
      winner: frameOver ? winner : undefined
    };
  }

  chooseColor (player, color) {
    if (!this.state.isOpenTable) return false;
    const opp = opponent(player);
    this.state.assignments[player] = color;
    this.state.assignments[opp] = color === 'blue' ? 'red' : 'blue';
    this.state.isOpenTable = false;
    this.state.lastEvent = 'COLOR_CHOSEN';
    return true;
  }
}

export default UkPool;
