import { resolvePoolRoyalCueStrike, stepPoolRoyalClothSpin, resolvePoolRoyalCushionSpin, hasPoolRoyalPlanarSlip } from './poolRoyaleSpinUtils.js';
import { resolvePoolRoyaleShotPowerScale } from './poolRoyaleShotState.js';
import { raycastPoolCushions } from './shared/poolRoyaleShowoodGeometry.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const dot = (a, b) => a.x * b.x + a.y * b.y;
const length = p => Math.hypot(p.x, p.y);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const unit = p => { const d = length(p); return d > 1e-9 ? { x: p.x / d, y: p.y / d } : { x: 0, y: 0 }; };
const distance = (a, b) => length(sub(a, b));
const cross = (a, b) => a.x * b.y - a.y * b.x;
const rotated = (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
const pointOn = (p, d, s) => ({ x: p.x + d.x * s, y: p.y + d.y * s });

export function poolRoyalAiLaneClear(start, end, balls, radius, ignore = new Set()) {
  const delta = sub(end, start), d2 = dot(delta, delta);
  return balls.every(ball => {
    if (ball.active === false || ignore.has(ball.id)) return true;
    const along = d2 > 1e-9 ? clamp(dot(sub(ball.pos, start), delta) / d2, 0, 1) : 0;
    return distance(ball.pos, pointOn(start, delta, along)) >= radius * 2.025;
  });
}

// Equal-mass sphere impulse, including the same 3D contact friction as the live
// game. Units are velocity per frame and angular velocity around world X/Y/Z.
export function predictPoolRoyalImpact(cue, normal, radius, restitution = 0.984, friction = 0.105) {
  const n = unit(normal), r = radius, w = cue.omega, v = cue.velocity;
  const closing = dot(v, n);
  if (closing <= 0) return null;
  const jn = (1 + restitution) * closing / 2;
  const relative = {
    x: -v.x - w.y * n.y * r,
    y: -(w.z * n.x - w.x * n.y) * r,
    z: -v.y + w.y * n.x * r
  };
  const tangent = { x: relative.x + closing * n.x, y: relative.y, z: relative.z + closing * n.y };
  const speed = Math.hypot(tangent.x, tangent.y, tangent.z);
  const jt = speed > 1e-9 ? -Math.min(speed / 7, friction * jn) / speed : 0;
  const ix = tangent.x * jt, iy = tangent.y * jt, iz = tangent.z * jt;
  const angular = 2.5 / r;
  const dw = { x: n.y * iy * angular, y: (n.x * iz - n.y * ix) * angular, z: -n.x * iy * angular };
  return {
    cue: { velocity: { x: v.x - n.x * jn - ix, y: v.y - n.y * jn - iz },
      omega: { x: w.x + dw.x, y: w.y + dw.y, z: w.z + dw.z } },
    object: { velocity: { x: n.x * jn + ix, y: n.y * jn + iz }, omega: dw }
  };
}

function step(ball, config) {
  const response = stepPoolRoyalClothSpin({ ...ball, radius: config.radius, dt: config.dt ?? 1 / 120,
    slidingFriction: config.slidingFriction, rollingFriction: config.rollingFriction,
    gravity: config.gravity, spinDamping: config.spinDamping });
  ball.velocity = response.velocity; ball.omega = response.omega;
  if (!hasPoolRoyalPlanarSlip(ball.velocity, ball.omega, config.radius, 0.00259)) {
    if (length(ball.velocity) < 0.0074) {
      ball.velocity.x *= 0.96; ball.velocity.y *= 0.96;
      ball.omega.x *= 0.96; ball.omega.z *= 0.96;
    }
    if (length(ball.velocity) < 0.00259) {
      ball.velocity = { x: 0, y: 0 }; ball.omega.x = 0; ball.omega.z = 0;
    }
  }
  return length(ball.velocity) > 0 || hasPoolRoyalPlanarSlip(ball.velocity, ball.omega, config.radius, 0.00259);
}

function circleHit(start, delta, center, radius) {
  const relative = sub(start, center), a = dot(delta, delta);
  const c = dot(relative, relative) - radius * radius;
  if (c <= 0) return 0;
  if (a < 1e-12) return null;
  const b = dot(relative, delta), discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

function traceRoll(position, state, config, { obstacles = [], object = false } = {}) {
  const ball = { position: { ...position }, velocity: { ...state.velocity }, omega: { ...state.omega } };
  let rails = 0;
  for (let frame = 0; frame < 2200; frame++) {
    if (!step(ball, config)) return { ...ball, finished: true, rails };
    const delta = ball.velocity, travel = length(delta);
    let pocket = -1, pocketT = Infinity;
    config.pockets.forEach((p, index) => {
      const t = circleHit(ball.position, delta, p, p.radius);
      if (t != null && t < pocketT) { pocket = index; pocketT = t; }
    });
    const nearRail = Math.abs(ball.position.x) + travel > config.width / 2 - config.radius * 1.2 ||
      Math.abs(ball.position.y) + travel > config.height / 2 - config.radius * 1.2;
    const rail = nearRail ? raycastPoolCushions(ball.position, delta, config.radius, config.segments, travel) : null;
    const railT = rail ? rail.distance / Math.max(travel, 1e-9) : Infinity;
    let obstructionT = Infinity;
    for (const other of obstacles) {
      const t = circleHit(ball.position, delta, other.pos, config.radius * 2);
      if (t != null) obstructionT = Math.min(obstructionT, t);
    }
    if (pocket >= 0 && pocketT <= Math.min(railT, obstructionT)) {
      return { ...ball, position: pointOn(ball.position, delta, pocketT), pocket, entrySpeed: travel, finished: true, rails };
    }
    if (obstructionT <= railT && obstructionT <= 1) {
      return { ...ball, position: pointOn(ball.position, delta, obstructionT), disturbed: true, rails };
    }
    if (rail) {
      if (object) return { ...ball, blocked: true, rails };
      rails++;
      ball.position = pointOn(rail.point, rail.normal, config.radius * 0.001);
      const response = resolvePoolRoyalCushionSpin({ ...ball, normal: rail.normal, radius: config.radius,
        restitution: config.cushionRestitution ?? 0.96, friction: config.railFriction ?? 0.16 });
      ball.velocity = response.velocity; ball.omega = response.omega;
    } else ball.position = pointOn(ball.position, delta, 1);
    if (Math.abs(ball.position.x) > config.width / 2 + config.radius * 4 ||
        Math.abs(ball.position.y) > config.height / 2 + config.radius * 4) return { ...ball, escaped: true, rails };
  }
  return { ...ball, exhausted: true, rails };
}

function approach(cuePos, ghost, power, spin, config) {
  const route = sub(ghost, cuePos), dist = length(route), aim = unit(route);
  const ball = resolvePoolRoyalCueStrike({ spin, direction: aim, radius: config.radius,
    speed: config.baseSpeed * resolvePoolRoyaleShotPowerScale(power) });
  let travelled = 0;
  for (let frame = 0; frame < 1800; frame++) {
    if (!step(ball, config)) return null;
    travelled += length(ball.velocity);
    if (travelled >= dist) return ball;
  }
  return null;
}

export function simulatePoolRoyalPot(plan, { cuePos, balls, ...config }, power, spin) {
  if (!plan?.targetBall?.pos || !plan.pocketCenter || plan.viaCushion) return null;
  const target = plan.targetBall, pocketVector = sub(plan.pocketCenter, target.pos);
  const normal = unit(pocketVector), aimDistance = length(pocketVector);
  if (aimDistance < config.radius) return null;
  const ignore = new Set([config.cueId ?? 'cue', target.id]);
  const obstacles = balls.filter(b => b.active !== false && !ignore.has(b.id));
  let correction = 0, impact, ghost, aim, object;
  // Estimate throw from contact friction, then solve the contact normal again.
  // This is physics-based compensation; no random or empirical aim offset.
  for (let pass = 0; pass < 3; pass++) {
    const contactNormal = rotated(normal, correction);
    ghost = pointOn(target.pos, contactNormal, -config.radius * 2);
    aim = unit(sub(ghost, cuePos));
    if (dot(aim, contactNormal) < 0.12 ||
        !poolRoyalAiLaneClear(cuePos, ghost, balls, config.radius, ignore) ||
        raycastPoolCushions(cuePos, aim, config.radius, config.segments, distance(cuePos, ghost))) return null;
    const incoming = approach(cuePos, ghost, power, spin, config);
    if (!incoming) return null;
    impact = predictPoolRoyalImpact(incoming, contactNormal, config.radius, config.restitution, config.ballFriction);
    if (!impact) return null;
    // Cloth can change the launch direction as the object ball settles to roll.
    const probe = { velocity: { ...impact.object.velocity }, omega: { ...impact.object.omega } };
    let probePosition = { ...target.pos };
    for (let i = 0; i < 300 && step(probe, config); i++) {
      probePosition = pointOn(probePosition, probe.velocity, 1);
      if (distance(probePosition, target.pos) >= aimDistance) break;
    }
    const outgoing = unit(sub(probePosition, target.pos));
    const error = Math.atan2(cross(normal, outgoing), dot(normal, outgoing));
    if (pass < 2 && Math.abs(error) > 0.001) { correction = clamp(correction - error, -0.12, 0.12); continue; }
    object = traceRoll(target.pos, impact.object, config, { obstacles, object: true });
    break;
  }
  if (!object || object.pocket !== plan.pocketIndex || object.entrySpeed < 0.035) return null;
  const leave = traceRoll(ghost, impact.cue, config, { obstacles });
  if (leave.pocket != null || leave.escaped || leave.exhausted || leave.disturbed) return null;
  return { aimDir: aim, ghost, cueAfter: leave.position, rails: leave.rails,
    entrySpeed: object.entrySpeed, power, spin: { ...spin }, scratchRisk: false };
}

export function scorePoolRoyalLeave(cueAfter, targets, balls, config) {
  if (!targets.length) return 1; // Frame-winning pot: prioritize the pot itself.
  let best = 0;
  for (const target of targets) for (let index = 0; index < config.pockets.length; index++) {
    const pocket = config.entranceForTarget?.(target.pos, index) ?? config.pockets[index];
    const direction = unit(sub(pocket, target.pos)), ghost = pointOn(target.pos, direction, -config.radius * 2);
    const cueRoute = sub(ghost, cueAfter), objectRoute = sub(pocket, target.pos);
    const cosine = dot(unit(cueRoute), direction);
    if (cosine < 0.22) continue;
    const ignore = new Set([config.cueId ?? 'cue', target.id]);
    if (!poolRoyalAiLaneClear(cueAfter, ghost, balls, config.radius, ignore) ||
        !poolRoyalAiLaneClear(target.pos, pocket, balls, config.radius, ignore) ||
        raycastPoolCushions(cueAfter, cueRoute, config.radius, config.segments, length(cueRoute)) ||
        raycastPoolCushions(target.pos, objectRoute, config.radius, config.segments, length(objectRoute))) continue;
    const routeEase = 1 - clamp((length(cueRoute) + length(objectRoute)) / (config.width + config.height), 0, 1);
    const railSpace = clamp(Math.min(config.width / 2 - Math.abs(cueAfter.x), config.height / 2 - Math.abs(cueAfter.y)) / (config.radius * 5), 0, 1);
    best = Math.max(best, cosine * 0.5 + routeEase * 0.35 + railSpace * 0.15);
  }
  return best;
}

/** Bounded, deterministic search, cached by the caller for each table layout. */
export function refinePoolRoyalPotPlans(plans, context) {
  const shortlist = plans.filter(plan => !plan.viaCushion)
    .sort((a, b) => (b.potChance ?? b.quality ?? 0) - (a.potChance ?? a.quality ?? 0))
    .slice(0, 16);
  const refined = [];
  for (const plan of shortlist) {
    const nextTargets = context.nextTargets(plan);
    if (!Array.isArray(nextTargets)) continue; // Do not guess a rules transition.
    const remaining = context.balls.filter(b => b.active !== false && b !== plan.targetBall);
    let best = null, bestScore = -Infinity;
    for (const power of [0.28, 0.4, 0.52, 0.64, 0.76, 0.88]) for (const y of [0, -0.5, 0.5]) {
      const trial = simulatePoolRoyalPot(plan, context, power, { x: 0, y });
      if (!trial) continue;
      const nextShotScore = scorePoolRoyalLeave(trial.cueAfter, nextTargets, remaining, context);
      // Potting speed and a useful next shot beat unnecessary power or rails.
      const score = nextShotScore * 0.72 - power * 0.13 - trial.rails * 0.06 -
        Math.max(0, trial.entrySpeed / context.baseSpeed - 0.45) * 0.2;
      if (score > bestScore) { bestScore = score; best = { ...trial, nextShotScore }; }
    }
    if (best) refined.push({ ...plan, ...best, aiMeta: { ...plan.aiMeta, source: 'physics-position',
      predictedSafe: true, nextBallIds: nextTargets.map(ball => ball.id) } });
  }
  return refined;
}
