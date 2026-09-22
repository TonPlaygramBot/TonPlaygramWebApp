import { normalizePoolBallId, normalizePoolPots, countPoolBreakObjectRails } from './poolShotInput.js';

function opponent (p) {
  return p === 'A' ? 'B' : 'A';
}

export class NineBall {
  constructor ({ profile = 'standard' } = {}) {
    this.profile = profile === 'reference' ? 'reference' : 'standard';
    this.state = {
      ballsOnTable: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      currentPlayer: 'A',
      ballInHand: false,
      gameOver: false,
      winner: null,
      foulStreak: { A: 0, B: 0 },
      pushOutAvailable: false,
      pushOutPending: null,
      breakInProgress: true
    };
  }

  shotTaken (shot = {}) {
    const s = this.state;
    const contactOrder = Array.isArray(shot.contactOrder) ? shot.contactOrder : [];
    const pottedList = normalizePoolPots(shot.potted, s.ballsOnTable, 9);
    if (s.gameOver) {
      return { legal: false, foul: true, reason: 'game over', potted: [], nextPlayer: s.currentPlayer, ballInHandNext: false, frameOver: true, winner: s.winner };
    }
    if (s.pushOutPending) {
      return { legal: false, foul: false, reason: 'push-out decision required', potted: [],
        nextPlayer: s.currentPlayer, ballInHandNext: false, frameOver: false, winner: null };
    }
    const current = s.currentPlayer;
    const opp = opponent(current);
    const lowest = s.ballsOnTable.size ? Math.min(...s.ballsOnTable) : null;
    const wasBreakShot = Boolean(s.breakInProgress);
    const isPushOut = Boolean(shot.pushOut && this.profile === 'standard' && s.pushOutAvailable && !wasBreakShot);
    const offTableIds = normalizePoolPots(shot.offTable, s.ballsOnTable, 9);
    const offTable = offTableIds.filter(id => id !== 0);
    const railContactsAfterFirstHit = countPoolBreakObjectRails(shot, s.ballsOnTable, 9);
    let foul = false;
    let reason = '';
    if (shot.pushOut && !isPushOut) {
      foul = true;
      reason = 'push out unavailable';
    }

    const first = normalizePoolBallId(contactOrder[0], 9);
    if (!foul && !isPushOut && !first) {
      foul = true;
      reason = 'no contact';
    }

    if (!foul && !isPushOut && first !== lowest) {
      foul = true;
      reason = 'wrong first contact';
    }

    if (!foul && (pottedList.includes(0) || offTableIds.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }
    if (!foul && offTable.length) {
      foul = true;
      reason = 'object ball off table';
    }

    const pottedBalls = pottedList.filter(id => id !== 0);
    if (!foul && !isPushOut && shot.noCushionAfterContact && pottedBalls.length === 0) {
      foul = true;
      reason = 'no cushion';
    }
    if (typeof shot.foulReason === 'string' && shot.foulReason.trim()) {
      foul = true;
      reason = shot.foulReason;
    }

    if (!foul && this.profile === 'standard' && wasBreakShot) {
      const legalBreak = pottedBalls.length > 0 || railContactsAfterFirstHit >= 4;
      if (!legalBreak) {
        foul = true;
        reason = 'illegal break';
      }
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    let frameOver = false;
    let winner = null;
    const foulLimit = 3;

    if (foul) {
      // Any object balls potted on a foul stay down except the nine, which is
      // spotted back on the table. The inning still passes to the opponent.
      for (const id of pottedBalls) {
        if (id === 9) s.ballsOnTable.add(id);
        else s.ballsOnTable.delete(id);
      }
      nextPlayer = opp;
      ballInHandNext = true;
      s.currentPlayer = opp;
      s.foulStreak[current] = (s.foulStreak[current] ?? 0) + 1;
    } else {
      for (const id of pottedBalls) {
        if (id !== 9 || !isPushOut) s.ballsOnTable.delete(id);
      }
      s.foulStreak[current] = 0;
      if (pottedBalls.includes(9) && !isPushOut) {
        frameOver = true;
        winner = current;
        s.gameOver = true;
        s.winner = winner;
      }
      if (frameOver) {
        nextPlayer = current;
      } else if (pottedBalls.length === 0 || isPushOut) {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

    for (const id of offTable) {
      if (id !== 9) s.ballsOnTable.delete(id);
    }
    s.pushOutAvailable = Boolean(this.profile === 'standard' && wasBreakShot && !foul && !frameOver);
    s.pushOutPending = isPushOut && !foul ? { shooter: current, chooser: opp } : null;

    s.ballInHand = ballInHandNext;
    s.breakInProgress = false;

    if (!frameOver && this.profile === 'standard' && s.foulStreak[current] >= foulLimit) {
      frameOver = true;
      winner = opp;
      s.gameOver = true;
      s.winner = winner;
      ballInHandNext = false;
      s.ballInHand = false;
    }

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

  /** The opponent may accept the layout or return the shot to the pusher. */
  resolvePushOut (choice) {
    const pending = this.state.pushOutPending;
    if (!pending || (choice !== 'accept' && choice !== 'return') || this.state.gameOver) return false;
    this.state.currentPlayer = choice === 'return' ? pending.shooter : pending.chooser;
    this.state.pushOutPending = null;
    this.state.pushOutAvailable = false;
    this.state.ballInHand = false;
    return true;
  }
}

export default NineBall;
