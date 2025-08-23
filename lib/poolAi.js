// Minimal billiards AI planner

/** @typedef {'AMERICAN_BILLIARDS'|'NINE_BALL'|'EIGHT_POOL_UK'} GameType */

/**
 * @typedef {Object} Ball
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} vx
 * @property {number} vy
 * @property {boolean} pocketed
 */

/** @typedef {{x:number,y:number}} Pocket */

/**
 * @typedef {Object} AimRequest
 * @property {GameType} game
 * @property {{balls:Ball[],pockets:Pocket[],width:number,height:number,ballRadius:number,friction:number,myGroup?:'SOLIDS'|'STRIPES'|'UNASSIGNED',ballInHand?:boolean}} state
 * @property {number} [timeBudgetMs]
 * @property {number} [rngSeed]
 */

/**
 * @typedef {Object} ShotDecision
 * @property {number} angleRad
 * @property {number} power
 * @property {{top:number,side:number,back:number}} spin
 * @property {number} [targetBallId]
 * @property {{x:number,y:number}} [targetPocket]
 * @property {number} quality
 * @property {string} rationale
 */

/** simple seeded RNG */
function makeRng(seed = Date.now()) {
  let s = seed % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

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

function chooseTargets(req) {
  const balls = req.state.balls.filter(b => !b.pocketed && b.id !== 0);
  if (req.game === 'NINE_BALL') {
    const lowest = balls.reduce((m, b) => b.id < m.id ? b : m, balls[0]);
    return [lowest];
  }
  if (req.game === 'AMERICAN_BILLIARDS' || req.game === 'EIGHT_POOL_UK') {
    const solids = balls.filter(b => b.id >= 1 && b.id <= 7);
    const stripes = balls.filter(b => b.id >= 9 && b.id <= 15);
    const eight = balls.find(b => b.id === 8);
    if (req.state.myGroup === 'SOLIDS') {
      if (solids.length > 0) return solids;
      if (eight) return [eight];
      return [];
    }
    if (req.state.myGroup === 'STRIPES') {
      if (stripes.length > 0) return stripes;
      if (eight) return [eight];
      return [];
    }
    return balls.filter(b => b.id !== 8);
  }
  return balls;
}

function nextTargetsAfter(targetId, req) {
  const cloned = req.state.balls.filter(b => !b.pocketed && b.id !== targetId && b.id !== 0);
  if (req.game === 'NINE_BALL') {
    if (cloned.length === 0) return [];
    const lowest = cloned.reduce((m, b) => b.id < m.id ? b : m, cloned[0]);
    return [lowest];
  }
  if (req.game === 'AMERICAN_BILLIARDS' || req.game === 'EIGHT_POOL_UK') {
    const solids = cloned.filter(b => b.id >= 1 && b.id <= 7);
    const stripes = cloned.filter(b => b.id >= 9 && b.id <= 15);
    const eight = cloned.find(b => b.id === 8);
    if (req.state.myGroup === 'SOLIDS') {
      if (solids.length > 0) return solids;
      if (eight) return [eight];
      return [];
    }
    if (req.state.myGroup === 'STRIPES') {
      if (stripes.length > 0) return stripes;
      if (eight) return [eight];
      return [];
    }
    return cloned.filter(b => b.id !== 8);
  }
  return cloned;
}

function estimateCueAfterShot(cue, target, pocket, power) {
  const toTarget = { x: target.x - cue.x, y: target.y - cue.y };
  const toPocket = { x: pocket.x - target.x, y: pocket.y - target.y };
  const dir = { x: toTarget.x - toPocket.x, y: toTarget.y - toPocket.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const scale = power * 120 / len;
  return { x: target.x + dir.x * scale, y: target.y + dir.y * scale };
}

function blocked(cue, ghost, balls, ignoreId, radius) {
  return balls.some(b => b.id !== 0 && b.id !== ignoreId && !b.pocketed && lineIntersectsBall(cue, ghost, b, radius));
}

function evaluate(req, cue, target, pocket, power, spin) {
  const r = req.state.ballRadius;
  const ghost = {
    x: target.x - (pocket.x - target.x) * (r * 2 / dist(target, pocket)),
    y: target.y - (pocket.y - target.y) * (r * 2 / dist(target, pocket))
  };
  if (
    blocked(cue, ghost, req.state.balls, target.id, r) ||
    pathBlocked(target, pocket, req.state.balls, [0, target.id], r)
  ) {
    return null;
  }
  const maxD = Math.hypot(req.state.width, req.state.height);
  const distShot = dist(cue, target) + dist(target, pocket);
  const potChance = 1 - Math.min(distShot / maxD, 1);
  const cueAfter = estimateCueAfterShot(cue, target, pocket, power);
  const nextTargets = nextTargetsAfter(target.id, req);
  let nextScore = 0;
  if (nextTargets.length > 0) {
    const next = nextTargets[0];
    nextScore = 1 - Math.min(dist(cueAfter, next) / maxD, 1);
  }
  const risk = req.state.pockets.some(p => dist(cueAfter, p) < r * 1.2) ? 1 : 0;
  const quality = Math.max(0, Math.min(1, 0.7 * potChance + 0.3 * nextScore - 0.2 * risk));
  const angle = Math.atan2(ghost.y - cue.y, ghost.x - cue.x);
  return {
    angleRad: angle,
    power,
    spin,
    targetBallId: target.id,
    targetPocket: pocket,
    quality,
    rationale: `target=${target.id} pocket=(${pocket.x.toFixed(0)},${pocket.y.toFixed(0)}) angle=${angle.toFixed(2)} power=${power.toFixed(2)} spin=${spin.top.toFixed(2)},${spin.side.toFixed(2)},${spin.back.toFixed(2)} pc=${potChance.toFixed(2)} np=${nextScore.toFixed(2)} r=${risk.toFixed(2)}`
  };
}

/**
 * @param {AimRequest} req
 * @returns {ShotDecision}
 */
export function planShot(req) {
  const cue = req.state.balls.find(b => b.id === 0);
  const pockets = req.state.pockets;
  const targets = chooseTargets(req);
  const start = Date.now();
  const deadline = req.timeBudgetMs ? start + req.timeBudgetMs : Infinity;
  let best = null;
  outer: for (const target of targets) {
    for (const pocket of pockets) {
      const powers = [0.6, 0.8, 1.0];
      const spins = [
        { top: 0, side: 0, back: 0 },
        { top: 0.3, side: 0, back: -0.3 },
        { top: -0.3, side: 0.3, back: 0 }
      ];
      for (const power of powers) {
        for (const spin of spins) {
          if (Date.now() > deadline) break outer;
          const cand = evaluate(req, cue, target, pocket, power, spin);
          if (cand && (!best || cand.quality > best.quality)) best = cand;
        }
      }
    }
  }
  return best || {
    angleRad: 0,
    power: 0,
    spin: { top: 0, side: 0, back: 0 },
    quality: 0,
    rationale: 'no shot'
  };
}

export default planShot;
