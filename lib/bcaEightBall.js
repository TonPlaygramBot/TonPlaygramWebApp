import { normalizePoolBallId, normalizePoolPots, countPoolBreakObjectRails } from './poolShotInput.js';

function opponent(player) {
  return player === 'A' ? 'B' : 'A';
}

function groupForBall(ballId) {
  if (ballId >= 1 && ballId <= 7) return 'SOLID';
  if (ballId >= 9 && ballId <= 15) return 'STRIPE';
  return null;
}

function remainingGroupBalls(ballsOnTable, group) {
  if (!group) return 0;
  let remaining = 0;
  for (const id of ballsOnTable) {
    if (groupForBall(id) === group) remaining += 1;
  }
  return remaining;
}

export class BcaEightBall {
  constructor({ profile = 'standard' } = {}) {
    this.profile = profile === 'reference' ? 'reference' : 'standard';
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      assignments: { A: null, B: null },
      ballInHand: false,
      frameOver: false,
      winner: null,
      breakInProgress: true
    };
  }

  shotTaken(shot = {}) {
    const s = this.state;
    const contactOrder = Array.isArray(shot.contactOrder) ? shot.contactOrder : [];
    const pottedList = normalizePoolPots(shot.potted, s.ballsOnTable, 15);
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

    const shooter = s.currentPlayer;
    const wasBreak = Boolean(s.breakInProgress);
    const other = opponent(shooter);
    const parsedFirst = normalizePoolBallId(contactOrder[0], 15);
    const first = s.ballsOnTable.has(parsedFirst) ? parsedFirst : null;
    const isReference = this.profile === 'reference';
    const objectPotted = pottedList.filter((id) => id !== 0);
    const cueScratched = pottedList.includes(0) || Boolean(shot.cueOffTable);
    const shooterGroup = s.assignments[shooter];
    const shooterGroupRemaining = remainingGroupBalls(s.ballsOnTable, shooterGroup);
    const eightLegallyOn = Boolean(shooterGroup && shooterGroupRemaining === 0);
    const firstContactGroup = Number.isFinite(first) ? groupForBall(first) : null;

    let foul = false;
    let reason = '';

    if (!first) {
      foul = true;
      reason = 'no contact';
    } else if (shooterGroup) {
      if (eightLegallyOn) {
        if (first !== 8) {
          foul = true;
          reason = 'wrong first contact';
        }
      } else if (firstContactGroup !== shooterGroup) {
        foul = true;
        reason = 'wrong first contact';
      }
    } else if (first === 8 && (isReference || !wasBreak)) {
      foul = true;
      reason = 'wrong first contact';
    }

    if (!foul && cueScratched) {
      foul = true;
      reason = 'scratch';
    }

    if (!foul && shot.noCushionAfterContact && objectPotted.length === 0) {
      foul = true;
      reason = 'no cushion';
    }

    if (typeof shot.foulReason === 'string' && shot.foulReason.trim()) {
      foul = true;
      reason = shot.foulReason;
    }

    const pottedEight = objectPotted.includes(8);
    if (!foul && !isReference && wasBreak && objectPotted.length === 0 &&
        countPoolBreakObjectRails(shot, s.ballsOnTable, 15) < 4) {
      foul = true;
      reason = 'illegal break';
    }
    if (!foul && !isReference && pottedEight && !eightLegallyOn && !wasBreak) {
      foul = true;
      reason = 'potted black early';
    }

    let frameOver = false;
    let winner = null;
    let nextPlayer = shooter;
    let ballInHandNext = false;

    if (isReference && pottedEight) {
      // The requested reference game uses an early-eight respot rule, and
      // assesses completion after this shot's pots. Keep its explicit variant
      // separate from the standard game's early-eight loss and break respot.
      for (const id of objectPotted) {
        if (id !== 8) s.ballsOnTable.delete(id);
      }
      if (foul) {
        const anotherObjectRemains = [...s.ballsOnTable].some(id => id !== 8);
        if (shooterGroup && anotherObjectRemains) {
          nextPlayer = other;
          ballInHandNext = true;
        } else {
          frameOver = true;
          winner = other;
          s.ballsOnTable.delete(8);
        }
      } else if (shooterGroup && remainingGroupBalls(s.ballsOnTable, shooterGroup) === 0) {
        frameOver = true;
        winner = shooter;
        s.ballsOnTable.delete(8);
      } else {
        foul = true;
        reason = 'potted black early';
        nextPlayer = other;
        ballInHandNext = true;
      }
    } else if (foul) {
      for (const id of objectPotted) {
        if (id !== 8) s.ballsOnTable.delete(id);
      }
      if (pottedEight && !wasBreak) {
        frameOver = true;
        winner = other;
        s.ballsOnTable.delete(8);
      } else {
        nextPlayer = other;
        ballInHandNext = true;
      }
    } else {
      for (const id of objectPotted) {
        if (id !== 8 || !wasBreak) s.ballsOnTable.delete(id);
      }
      if (!shooterGroup && (isReference || !wasBreak)) {
        const groupsPotted = new Set(objectPotted.map((id) => groupForBall(id)).filter(Boolean));
        if (groupsPotted.size === 1) {
          const chosen = groupsPotted.has('SOLID') ? 'SOLID' : 'STRIPE';
          s.assignments[shooter] = chosen;
          s.assignments[other] = chosen === 'SOLID' ? 'STRIPE' : 'SOLID';
        }
      }
      if (pottedEight && !wasBreak) {
        frameOver = true;
        winner = shooter;
      } else {
        const activeGroup = s.assignments[shooter];
        const scoredOwnGroup =
          objectPotted.some((id) => groupForBall(id) === activeGroup) ||
          (!activeGroup && objectPotted.some((id) => id !== 8)) ||
          (wasBreak && objectPotted.length > 0);
        if (!scoredOwnGroup) nextPlayer = other;
      }
    }
    s.currentPlayer = nextPlayer;

    s.ballInHand = ballInHandNext;
    if (s.breakInProgress) s.breakInProgress = false;
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

export default BcaEightBall;
