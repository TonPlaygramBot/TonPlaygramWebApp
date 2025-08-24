// Advanced UK 8-Ball Pool AI planner
// Generates candidate shots, evaluates probabilities and positional play,
// and returns the best plan according to expected value heuristics.

/**
 * @typedef {'yellow'|'red'|'black'|'cue'} BallColour
 *
 * @typedef {Object} Ball
 * @property {number} id
 * @property {BallColour} colour
 * @property {number} x
 * @property {number} y
 * @property {boolean} [pocketed]
 *
 * @typedef {Object} Pocket
 * @property {number} x
 * @property {number} y
 * @property {'TL'|'TR'|'ML'|'MR'|'BL'|'BR'} name
 *
 * @typedef {Object} TableState
 * @property {Ball[]} balls
 * @property {Pocket[]} pockets
 * @property {number} width
 * @property {number} height
 * @property {number} ballRadius
 * @property {'yellow'|'red'|null} [ballOn]   // group of current player; null on open table
 * @property {boolean} [isOpenTable]
 * @property {boolean} [freeBallAvailable]
 * @property {number} [shotsRemaining]
 *
 * @typedef {Object} CandidateShot
 * @property {'pot'|'safety'|'freeBallPot'} actionType
 * @property {Ball|null} targetBall
 * @property {Pocket|null} pocket
 * @property {{speed:'soft'|'med'|'firm',spin:'stun'|'followS'|'followL'|'drawS'|'drawL'|'sideL'|'sideR'}} cueParams
 * @property {boolean} [isSafety]
 *
 * @typedef {Object} Plan
 * @property {'pot'|'safety'|'freeBallPot'} actionType
 * @property {'yellow'|'red'|'black'|null} targetBall
 * @property {'TL'|'TR'|'ML'|'MR'|'BL'|'BR'|null} pocket
 * @property {{x:number,y:number}} aimPoint
 * @property {{speed:'soft'|'med'|'firm',spin:'stun'|'followS'|'followL'|'drawS'|'drawL'|'sideL'|'sideR'}} cueParams
 * @property {{x:number,y:number,radius:number}} positionTarget
 * @property {number} EV
 * @property {string} notes
 */

// ----------------- geometry helpers -----------------
function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function lineIntersectsBall(a, b, ball, radius) {
  const apx = ball.x - a.x;
  const apy = ball.y - a.y;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = (apx * abx + apy * aby) / (abx * abx + aby * aby);
  if (t <= 0 || t >= 1) return false;
  const closest = { x: a.x + abx * t, y: a.y + aby * t };
  return dist(closest, ball) < radius * 2;
}

function pathBlocked(a, b, balls, ignoreIds, radius) {
  return balls.some(
    ball =>
      !ball.pocketed &&
      !ignoreIds.includes(ball.id) &&
      lineIntersectsBall(a, b, ball, radius)
  );
}

// Returns angle between cue->ball and ball->pocket in radians
function cutAngle(cue, target, pocket) {
  const v1 = { x: target.x - cue.x, y: target.y - cue.y };
  const v2 = { x: pocket.x - target.x, y: pocket.y - target.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  const cos = Math.min(Math.max(dot / (mag1 * mag2), -1), 1);
  return Math.acos(cos);
}

// ----------------- candidate generation -----------------
function visibleOwnBalls(state, colour) {
  const cue = state.balls.find(b => b.colour === 'cue');
  const res = [];
  for (const ball of state.balls) {
    if (ball.pocketed) continue;
    if (ball.colour !== colour) continue;
    if (!pathBlocked(cue, ball, state.balls, [cue.id], state.ballRadius)) {
      res.push(ball);
    }
  }
  return res;
}

function generatePotCandidates(state, colour) {
  const cue = state.balls.find(b => b.colour === 'cue');
  const balls = visibleOwnBalls(state, colour);
  const shots = [];
  for (const ball of balls) {
    for (const pocket of state.pockets) {
      if (pathBlocked(ball, pocket, state.balls, [cue.id, ball.id], state.ballRadius)) continue;
      const angle = cutAngle(cue, ball, pocket);
      const distCT = dist(cue, ball);
      const distTP = dist(ball, pocket);
      const shot = {
        actionType: 'pot',
        targetBall: ball,
        pocket,
        cueParams: { speed: 'med', spin: 'stun' },
        angle,
        distCT,
        distTP,
      };
      shots.push(shot);
    }
  }
  return shots;
}

function generateFreeBallCandidates(state, colour) {
  // simple anchors: place cue on line from ball to nearest pocket
  const shots = [];
  for (const ball of state.balls) {
    if (ball.pocketed || ball.colour !== colour) continue;
    let bestPocket = null;
    let bestDist = Infinity;
    for (const pocket of state.pockets) {
      const d = dist(ball, pocket);
      if (d < bestDist) { bestDist = d; bestPocket = pocket; }
    }
    if (bestPocket) {
      const anchor = { x: ball.x - (bestPocket.x - ball.x), y: ball.y - (bestPocket.y - ball.y) };
      const shot = {
        actionType: 'freeBallPot',
        targetBall: ball,
        pocket: bestPocket,
        cueParams: { speed: 'med', spin: 'stun' },
        angle: 0,
        distCT: dist(anchor, ball),
        distTP: bestDist,
        anchor
      };
      shots.push(shot);
    }
  }
  return shots;
}

function generateSafeties(state, colour) {
  const cue = state.balls.find(b => b.colour === 'cue');
  const oppColour = colour === 'yellow' ? 'red' : 'yellow';
  const oppBalls = state.balls.filter(b => b.colour === oppColour && !b.pocketed);
  if (oppBalls.length === 0) return [];
  // simple safety: thin off first opponent ball to rail
  const target = oppBalls[0];
  return [{
    actionType: 'safety',
    targetBall: target,
    pocket: null,
    cueParams: { speed: 'soft', spin: 'stun' },
    isSafety: true,
    angle: Math.PI / 4,
    distCT: dist(cue, target),
    distTP: 0,
  }];
}

// ----------------- evaluation heuristics -----------------
function estimatePotProbability(shot, state) {
  const angleDeg = shot.angle * 180 / Math.PI;
  let angleScore = 0.3;
  if (angleDeg <= 25) angleScore = 0.9; else if (angleDeg <= 45) angleScore = 0.6;
  const maxD = Math.hypot(state.width, state.height);
  const distScore = 1 - Math.min((shot.distCT + shot.distTP) / maxD, 1);
  let P = angleScore * 0.7 + distScore * 0.3;
  // rail penalty
  const target = shot.targetBall;
  if (target && (Math.min(target.x, state.width - target.x) < state.ballRadius * 2 || Math.min(target.y, state.height - target.y) < state.ballRadius * 2)) {
    P -= 0.1;
  }
  if (state.shotsRemaining && state.shotsRemaining > 1) P += 0.05; // under pressure bonus
  return Math.max(0, Math.min(1, P));
}

function simulateCueRollout(state, shot) {
  const cue = state.balls.find(b => b.colour === 'cue');
  const ball = shot.targetBall;
  let pos = { x: ball.x, y: ball.y };
  const toPocket = { x: shot.pocket.x - ball.x, y: shot.pocket.y - ball.y };
  const toPocketLen = Math.hypot(toPocket.x, toPocket.y) || 1;
  const dirPocket = { x: toPocket.x / toPocketLen, y: toPocket.y / toPocketLen };
  const toCue = { x: ball.x - cue.x, y: ball.y - cue.y };
  const toCueLen = Math.hypot(toCue.x, toCue.y) || 1;
  const dirCue = { x: toCue.x / toCueLen, y: toCue.y / toCueLen };
  switch (shot.cueParams.spin) {
    case 'followS':
      pos = { x: pos.x + dirPocket.x * 30, y: pos.y + dirPocket.y * 30 }; break;
    case 'followL':
      pos = { x: pos.x + dirPocket.x * 60, y: pos.y + dirPocket.y * 60 }; break;
    case 'drawS':
      pos = { x: pos.x + dirCue.x * 20, y: pos.y + dirCue.y * 20 }; break;
    case 'drawL':
      pos = { x: pos.x + dirCue.x * 40, y: pos.y + dirCue.y * 40 }; break;
    case 'sideL': {
      const angle = Math.atan2(dirPocket.y, dirPocket.x) - Math.PI / 12;
      pos = { x: pos.x + Math.cos(angle) * 40, y: pos.y + Math.sin(angle) * 40 }; break;
    }
    case 'sideR': {
      const angle = Math.atan2(dirPocket.y, dirPocket.x) + Math.PI / 12;
      pos = { x: pos.x + Math.cos(angle) * 40, y: pos.y + Math.sin(angle) * 40 }; break;
    }
    default: // stun
      // cue stops near target
      pos = { x: pos.x, y: pos.y };
  }
  return { x: pos.x, y: pos.y };
}

function generateFastCandidates(state, colour) {
  // only consider straight pots for nearest ball
  const cue = state.balls.find(b => b.colour === 'cue');
  const ownBalls = visibleOwnBalls(state, colour);
  if (ownBalls.length === 0) return [];
  const ball = ownBalls.reduce((m, b) => dist(cue, b) < dist(cue, m) ? b : m, ownBalls[0]);
  let bestPocket = null;
  let bestDist = Infinity;
  for (const p of state.pockets) {
    if (pathBlocked(ball, p, state.balls, [cue.id, ball.id], state.ballRadius)) continue;
    const d = dist(ball, p);
    if (d < bestDist) { bestDist = d; bestPocket = p; }
  }
  if (!bestPocket) return [];
  return [{ actionType: 'pot', targetBall: ball, pocket: bestPocket, cueParams: { speed: 'med', spin: 'stun' }, angle: cutAngle(cue, ball, bestPocket), distCT: dist(cue, ball), distTP: bestDist }];
}

function valueOfPositionAfter(nc, state, colour) {
  // simple heuristic: high if still have easy pot
  const P2 = estimatePotProbability(nc, state);
  const remaining = state.balls.filter(b => b.colour === colour && !b.pocketed).length;
  const base = remaining <= 1 ? 1.2 : 0.8; // higher when nearly finishing
  return P2 * base;
}

function foulRisk(shot, state) {
  // basic scratch risk if cue after shot near pocket
  const cueAfter = simulateCueRollout(state, shot);
  return state.pockets.some(p => dist(cueAfter, p) < state.ballRadius * 1.2) ? 0.4 : 0;
}

function riskPenalty(risk) {
  return risk; // linear for simplicity
}

function safetyEV(state, colour) {
  // heuristic: leaving opponent far gives low EV for them
  const oppColour = colour === 'yellow' ? 'red' : 'yellow';
  const cue = state.balls.find(b => b.colour === 'cue');
  const oppBalls = state.balls.filter(b => b.colour === oppColour && !b.pocketed);
  if (oppBalls.length === 0) return 0.5;
  const oppNearest = oppBalls.reduce((m, b) => dist(cue, b) < dist(cue, m) ? b : m, oppBalls[0]);
  const d = dist(cue, oppNearest);
  const maxD = Math.hypot(state.width, state.height);
  return 0.3 + 0.4 * (d / maxD);
}

function evaluateCandidates(state, colour, candidates) {
  let best = null;
  for (const c of candidates) {
    let EV = 0;
    if (c.actionType === 'safety') {
      EV = safetyEV(state, colour);
    } else {
      const Ppot = estimatePotProbability(c, state);
      const nextState = { ...state, balls: state.balls.map(b => ({ ...b })) };
      const target = nextState.balls.find(b => b.id === c.targetBall.id);
      target.pocketed = true;
      const cue = nextState.balls.find(b => b.colour === 'cue');
      const cuePos = simulateCueRollout(state, c);
      cue.x = cuePos.x; cue.y = cuePos.y;
      const nextCands = generateFastCandidates(nextState, colour);
      let nextBest = 0;
      for (const nc of nextCands) {
        const EV2 = valueOfPositionAfter(nc, nextState, colour);
        if (EV2 > nextBest) nextBest = EV2;
      }
      const baseValue = 1;
      const risk = foulRisk(c, state);
      EV = Ppot * (baseValue + nextBest) - riskPenalty(risk);
    }
    if (!best || EV > best.EV) {
      best = { c, EV };
    }
  }
  return best;
}

function chooseBestAction(state, colour) {
  let candidates = generatePotCandidates(state, colour);
  if (state.freeBallAvailable) {
    candidates = candidates.concat(generateFreeBallCandidates(state, colour));
  }
  if (candidates.length === 0) {
    candidates = generateSafeties(state, colour);
  } else {
    const scored = candidates.map(c => estimatePotProbability(c, state));
    const maxPot = scored.reduce((m, p) => Math.max(m, p), 0);
    if (maxPot < 0.25) {
      candidates = candidates.concat(generateSafeties(state, colour));
    }
  }
  const best = evaluateCandidates(state, colour, candidates);
  if (!best) return null;
  const c = best.c;
  const cueBall = state.balls.find(b => b.colour === 'cue');
  let aim;
  if (c.targetBall && c.pocket) {
    const toPocket = {
      x: c.pocket.x - c.targetBall.x,
      y: c.pocket.y - c.targetBall.y
    };
    const lenTP = Math.hypot(toPocket.x, toPocket.y) || 1;
    aim = {
      x: c.targetBall.x - (toPocket.x / lenTP) * state.ballRadius * 2,
      y: c.targetBall.y - (toPocket.y / lenTP) * state.ballRadius * 2
    };
  } else if (c.targetBall) {
    aim = { x: c.targetBall.x, y: c.targetBall.y };
  } else {
    aim = { x: cueBall.x, y: cueBall.y };
  }
  const posTarget = c.actionType === 'safety'
    ? { x: cueBall.x, y: cueBall.y }
    : simulateCueRollout(state, c);
  return {
    actionType: c.actionType,
    targetBall: c.targetBall ? c.targetBall.colour : null,
    pocket: c.pocket ? c.pocket.name : null,
    aimPoint: aim,
    aim, // backwards compatibility for older code expecting `aim`
    cueParams: c.cueParams,
    positionTarget: { x: posTarget.x, y: posTarget.y, radius: 40 },
    EV: best.EV,
    notes: c.actionType === 'safety' ? 'safety play' : `pot ${c.targetBall?.colour ?? ''}`,
  };
}

// Public entry
export function selectShot(state, rules = {}) {
  const colour = state.ballOn;
  if (state.isOpenTable) {
    const planY = chooseBestAction({ ...state, ballOn: 'yellow', isOpenTable: false }, 'yellow');
    const planR = chooseBestAction({ ...state, ballOn: 'red', isOpenTable: false }, 'red');
    if (!planY) return planR;
    if (!planR) return planY;
    return planY.EV >= planR.EV ? planY : planR;
  }
  return chooseBestAction(state, colour);
}

export default selectShot;

