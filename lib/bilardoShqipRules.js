export class BilardoShqipRules {
  constructor(options = {}) {
    const targetScore = Number.isFinite(options.targetScore) ? options.targetScore : 61;
    this.state = {
      ballsOnTable: new Set(Array.from({ length: 15 }, (_, i) => i + 1)),
      currentPlayer: 'A',
      scores: { A: 0, B: 0 },
      frameOver: false,
      winner: null,
      breakInProgress: true,
      targetScore
    };
  }

  shotTaken(shot = {}) {
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
        winner: s.winner,
        scores: { ...s.scores }
      };
    }

    const current = s.currentPlayer;
    const opp = current === 'A' ? 'B' : 'A';
    const wasBreakShot = Boolean(s.breakInProgress);
    const first = contactOrder[0];
    const lowest = lowestBall(s.ballsOnTable);
    const pottedBalls = pottedList.filter((id) => id !== 0);
    let foul = false;
    let reason = '';

    if (!wasBreakShot && !first) {
      foul = true;
      reason = 'no contact';
    }
    if (!foul && !wasBreakShot && !isLegalFirstContact(first, { lowest })) {
      foul = true;
      reason = 'wrong first contact';
    }
    if (!foul && (pottedList.includes(0) || shot.cueOffTable)) {
      foul = true;
      reason = 'scratch';
    }

    let nextPlayer = current;
    let ballInHandNext = false;
    if (foul) {
      nextPlayer = opp;
      s.currentPlayer = opp;
      ballInHandNext = true;
      for (const id of pottedBalls) {
        if (id >= 1 && id <= 15) s.ballsOnTable.delete(id);
      }
    } else {
      for (const id of pottedBalls) {
        if (!s.ballsOnTable.has(id)) continue;
        s.ballsOnTable.delete(id);
        s.scores[current] = (s.scores[current] ?? 0) + id;
      }
    }

    const target = Number.isFinite(s.targetScore) ? s.targetScore : 61;
    let frameOver = false;
    let winner = null;
    if (s.scores[current] >= target) {
      frameOver = true;
      winner = current;
    } else if (s.ballsOnTable.size === 0) {
      frameOver = true;
      if (s.scores.A > s.scores.B) winner = 'A';
      else if (s.scores.B > s.scores.A) winner = 'B';
      else winner = 'TIE';
    }

    if (!frameOver) {
      if (foul) nextPlayer = opp;
      else if (pottedBalls.length > 0) nextPlayer = current;
      else {
        nextPlayer = opp;
        s.currentPlayer = opp;
      }
    }

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
      winner,
      scores: { ...s.scores }
    };
  }
}

export default BilardoShqipRules;

function lowestBall(balls) {
  let lowest = null;
  for (const id of balls) {
    if (lowest == null || id < lowest) lowest = id;
  }
  return lowest;
}

function isLegalFirstContact(first, { lowest }) {
  if (!Number.isFinite(first)) return false;
  if (lowest == null) return false;
  return first === lowest;
}
