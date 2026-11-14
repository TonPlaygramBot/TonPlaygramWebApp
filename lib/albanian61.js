import { normalizePoolBallId, normalizePoolPots, countPoolBreakObjectRails } from './poolShotInput.js';

export const ALBANIAN_61_TARGET = 61;

/**
 * Rotation 61 house rules. Balls score their face value, lowest ball first.
 * Foul pots are restored; after a foul, play from behind the head string.
 * A 60–60 rack awards the last legal potter one deciding point.
 */
export class Albanian61 {
  constructor() {
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, index) => index + 1)),
      currentPlayer: 'A',
      scores: { A: 0, B: 0 },
      ballInHand: true,
      mustPlayFromBaulk: true,
      frameOver: false,
      winner: null,
      breakInProgress: true,
      lastScorer: null,
      tieBreakBonus: null
    };
  }

  shotTaken(shot = {}) {
    const s = this.state;
    if (s.frameOver) {
      return { legal: false, foul: false, potted: [], points: 0,
        nextPlayer: s.currentPlayer, ballInHandNext: false,
        frameOver: true, winner: s.winner };
    }
    const shooter = s.currentPlayer;
    const other = shooter === 'A' ? 'B' : 'A';
    const lowest = s.ballsOnTable.size ? Math.min(...s.ballsOnTable) : null;
    const first = normalizePoolBallId(shot.contactOrder?.[0], 15);
    const potted = normalizePoolPots(shot.potted, s.ballsOnTable, 15);
    const objects = potted.filter(id => id !== 0);
    const offTable = normalizePoolPots(shot.offTable, s.ballsOnTable, 15);
    const scratched = potted.includes(0) || offTable.includes(0) || Boolean(shot.cueOffTable);
    let reason;
    if (!first || !s.ballsOnTable.has(first)) reason = 'no contact';
    else if (first !== lowest) reason = 'wrong first contact';
    else if (scratched) reason = 'scratch';
    else if (offTable.some(id => id !== 0)) reason = 'object ball off table';
    else if (objects.length === 0 && shot.noCushionAfterContact) reason = 'no cushion';
    else if (s.breakInProgress && objects.length === 0 &&
        countPoolBreakObjectRails(shot, s.ballsOnTable, 15) < 4) reason = 'illegal break';
    if (typeof shot.foulReason === 'string' && shot.foulReason.trim()) reason = shot.foulReason;

    const foul = Boolean(reason);
    const points = foul ? 0 : objects.reduce((total, id) => total + id, 0);
    // Keeping foul pots/off-table balls in the set requests physical re-spotting.
    if (!foul) {
      for (const id of objects) s.ballsOnTable.delete(id);
      s.scores[shooter] += points;
      if (points > 0) s.lastScorer = shooter;
      if (s.ballsOnTable.size === 0 && s.scores.A === 60 && s.scores.B === 60) {
        s.scores[shooter] += 1;
        s.tieBreakBonus = shooter;
      }
      if (s.scores[shooter] >= ALBANIAN_61_TARGET) {
        s.frameOver = true;
        s.winner = shooter;
      }
    }
    s.currentPlayer = foul || points === 0 ? other : shooter;
    s.ballInHand = foul;
    s.mustPlayFromBaulk = foul;
    s.breakInProgress = false;
    return { legal: !foul, foul, reason, potted, points,
      nextPlayer: s.currentPlayer, ballInHandNext: s.ballInHand,
      frameOver: s.frameOver, winner: s.winner };
  }
}

export default Albanian61;
