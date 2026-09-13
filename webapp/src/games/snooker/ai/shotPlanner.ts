/*! @license GPL-3.0-only — Snooker Royal / Tailuge adapter.
 * See /licenses/snooker-tailuge/NOTICE.md and GPL-3.0.txt.
 */
import {
  cutScore,
  direction,
  distance,
  dot,
  finitePoint,
  ghostBallPosition,
  rayBallDistance,
  type Point
} from './tailugeAim';

export interface AiBall {
  id: string | number;
  color: string;
  pos: Point;
  active: boolean;
}
export interface AiPocket {
  id: string;
  pos: Point;
  mouth: number;
}
export interface AiFrame {
  ballOn: readonly string[];
  frameOver?: boolean;
  activePlayer?: string;
}
export interface PlannerInput {
  balls: readonly AiBall[];
  cueId: string | number;
  frame: AiFrame;
  radius: number;
  halfWidth: number;
  halfHeight: number;
  pockets: readonly AiPocket[];
  pocketForTarget?: (target: AiBall, pocketIndex: number) => Point;
  powerForDistance: (distance: number) => number;
}
export interface ShotPlan {
  type: 'pot' | 'safety';
  aimDir: Point;
  power: number;
  target: string;
  targetId: string | number;
  pocketId: string;
  pocketCenter: Point | null;
  cueToTarget: number;
  targetToPocket: number;
  difficulty: number;
  quality: number;
  spin: Point;
  viaCushion: boolean;
  route: Point[];
  verifiedContact: boolean;
  source: 'tailuge';
}
export interface ShotOptions {
  bestPot: ShotPlan | null;
  bestSafety: ShotPlan | null;
}
const empty = (): ShotOptions => ({ bestPot: null, bestSafety: null });
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

/** Use the authoritative ball-on exactly. Blue and yellow are distinct in snooker. */
export function legalSnookerTargets(
  frame: AiFrame,
  balls: readonly AiBall[],
  cueId: string | number
): AiBall[] {
  if (frame.frameOver) return [];
  const colors = new Set(frame.ballOn.map((color) => color.toUpperCase()));
  return balls.filter(
    (b) =>
      b.active &&
      b.id !== cueId &&
      finitePoint(b.pos) &&
      colors.has(b.color.toUpperCase())
  );
}

/** Swept sphere clearance, using both ball radii rather than a center-line tolerance. */
function pathClear(
  start: Point,
  end: Point,
  balls: readonly AiBall[],
  ignore: Set<string | number>,
  radius: number
): boolean {
  const aim = direction(start, end);
  if (!aim) return true;
  const length = distance(start, end);
  return !balls.some((b) => {
    if (ignore.has(b.id)) return false;
    const hit = rayBallDistance(start, aim, b.pos, radius * 2.01);
    return hit !== null && hit <= length;
  });
}

function firstBall(
  origin: Point,
  aim: Point,
  balls: readonly AiBall[],
  cueId: string | number,
  radius: number
) {
  let result: { ball: AiBall; distance: number } | null = null;
  for (const ball of balls) {
    if (ball.id === cueId) continue;
    const hit = rayBallDistance(origin, aim, ball.pos, radius * 2);
    if (hit !== null && (!result || hit < result.distance))
      result = { ball, distance: hit };
  }
  return result;
}

export function planSnookerShot(input: PlannerInput): ShotOptions {
  const { radius, halfWidth, halfHeight, cueId, pockets, frame } = input;
  if (
    !(radius > 0 && halfWidth > radius && halfHeight > radius) ||
    frame.frameOver
  )
    return empty();
  const balls = input.balls.filter((b) => b.active && finitePoint(b.pos));
  const cue = balls.find((b) => b.id === cueId);
  if (!cue) return empty();
  const targets = legalSnookerTargets(frame, balls, cueId);
  if (!targets.length) return empty();
  const legalIds = new Set(targets.map((b) => b.id));
  const span = Math.hypot(halfWidth * 2, halfHeight * 2);
  const power = (length: number) => {
    const value = input.powerForDistance(length);
    return Number.isFinite(value) ? clamp(value, 0.05, 0.95) : 0.5;
  };
  let bestPot: ShotPlan | null = null;
  let bestSafety: ShotPlan | null = null;
  const inside = (p: Point) =>
    Math.abs(p.x) <= halfWidth && Math.abs(p.y) <= halfHeight;
  const nearPocket = (p: Point) =>
    pockets.some(
      (pocket) => distance(p, pocket.pos) < pocket.mouth / 2 + radius * 1.5
    );

  for (const target of targets) {
    const ignore = new Set([cueId, target.id]);
    for (let i = 0; i < pockets.length; i++) {
      const pocket = pockets[i];
      const mouth = input.pocketForTarget?.(target, i) ?? pocket.pos;
      if (!finitePoint(mouth)) continue;
      const ghost = ghostBallPosition(target.pos, mouth, radius);
      if (!ghost || !inside(ghost)) continue;
      const aim = direction(cue.pos, ghost);
      const exit = direction(target.pos, mouth);
      if (!aim || !exit) continue;
      const cutCos = dot(aim, exit);
      // A ghost behind the far side of a ball is not a playable cut.
      if (cutCos <= 0.2) continue;
      if (
        !pathClear(cue.pos, ghost, balls, ignore, radius) ||
        !pathClear(target.pos, mouth, balls, ignore, radius)
      )
        continue;
      const contact = firstBall(cue.pos, aim, balls, cueId, radius);
      if (!contact || contact.ball.id !== target.id) continue;
      const targetTravel = distance(target.pos, mouth);
      const cueTravel = contact.distance;
      // Reject extreme approaches along a cushion into a narrow side mouth.
      const inward = direction(mouth, { x: 0, y: 0 });
      const entry = inward ? -dot(exit, inward) : 1;
      if (entry < 0.12) continue;
      const residual = {
        x: aim.x - exit.x * cutCos,
        y: aim.y - exit.y * cutCos
      };
      const tangent = direction({ x: 0, y: 0 }, residual);
      const impact = {
        x: cue.pos.x + aim.x * cueTravel,
        y: cue.pos.y + aim.y * cueTravel
      };
      const scratch =
        tangent &&
        pockets.some((p) => {
          const hit = rayBallDistance(
            impact,
            tangent,
            p.pos,
            p.mouth / 2 + radius * 0.25
          );
          return hit !== null && hit < span * 0.45;
        });
      if (scratch) continue;
      // Account for energy lost in a cut; keep the existing game's power mapping.
      const shotPower = power(cueTravel + targetTravel / (cutCos * cutCos));
      const difficulty =
        (cueTravel + targetTravel * 1.15) / span +
        cutScore(cue.pos, target.pos, mouth) * 1.4;
      const quality = clamp(1 - difficulty * 0.35, 0, 1);
      const plan: ShotPlan = {
        type: 'pot',
        aimDir: aim,
        power: shotPower,
        target: target.color.toUpperCase(),
        targetId: target.id,
        pocketId: pocket.id,
        pocketCenter: { ...mouth },
        cueToTarget: cueTravel,
        targetToPocket: targetTravel,
        difficulty: difficulty * span,
        quality,
        spin: { x: 0, y: 0 },
        viaCushion: false,
        route: [{ ...cue.pos }, ghost],
        verifiedContact: true,
        source: 'tailuge'
      };
      if (!bestPot || plan.difficulty < bestPot.difficulty) bestPot = plan;
    }
  }

  // Ray-search legal contacts, including one/two cushion escapes. Fixed search
  // size bounds work on phones; physical coordinates and pocket openings come
  // from the existing table. The real solver still decides the shot outcome.
  const angles = targets.flatMap((b) => {
    const a = Math.atan2(b.pos.y - cue.pos.y, b.pos.x - cue.pos.x);
    const d = Math.asin(
      Math.min(0.85, radius / Math.max(radius * 2, distance(cue.pos, b.pos)))
    );
    return [a, a - d, a + d];
  });
  for (let i = 0; i < 180; i++) angles.push((i * Math.PI) / 90);
  for (const angle of angles) {
    const initial = { x: Math.cos(angle), y: Math.sin(angle) };
    let aim = { ...initial };
    let origin = { ...cue.pos };
    let travel = 0;
    const route: Point[] = [{ ...origin }];
    for (let bounce = 0; bounce <= 2; bounce++) {
      const tx =
        Math.abs(aim.x) > 1e-9
          ? ((aim.x > 0 ? halfWidth : -halfWidth) - origin.x) / aim.x
          : Infinity;
      const ty =
        Math.abs(aim.y) > 1e-9
          ? ((aim.y > 0 ? halfHeight : -halfHeight) - origin.y) / aim.y
          : Infinity;
      const wallDistance = Math.min(tx, ty);
      if (!(wallDistance > 1e-7) || !Number.isFinite(wallDistance)) break;
      const contact = firstBall(origin, aim, balls, cueId, radius);
      if (contact && contact.distance < wallDistance) {
        if (!legalIds.has(contact.ball.id)) break;
        const hit = {
          x: origin.x + aim.x * contact.distance,
          y: origin.y + aim.y * contact.distance
        };
        const pocketBefore = pockets.some((p) => {
          const t = rayBallDistance(origin, aim, p.pos, p.mouth / 2);
          return t !== null && t < contact.distance;
        });
        if (pocketBefore) break;
        travel += contact.distance;
        route.push(hit);
        const difficulty = travel + bounce * span * 0.6;
        const plan: ShotPlan = {
          type: 'safety',
          aimDir: initial,
          power: power(travel + radius * (bounce ? 22 : 10)),
          target: contact.ball.color.toUpperCase(),
          targetId: contact.ball.id,
          pocketId: 'SAFETY',
          pocketCenter: null,
          cueToTarget: travel,
          targetToPocket: 0,
          difficulty,
          quality: clamp(1 - difficulty / (span * 3), 0, 1),
          spin: { x: 0, y: 0 },
          viaCushion: bounce > 0,
          route,
          verifiedContact: true,
          source: 'tailuge'
        };
        if (!bestSafety || plan.difficulty < bestSafety.difficulty)
          bestSafety = plan;
        break;
      }
      const wall = {
        x: origin.x + aim.x * wallDistance,
        y: origin.y + aim.y * wallDistance
      };
      if (nearPocket(wall)) break;
      route.push(wall);
      travel += wallDistance;
      if (tx <= ty) aim.x *= -1;
      if (ty <= tx) aim.y *= -1;
      origin = {
        x: wall.x + aim.x * radius * 0.001,
        y: wall.y + aim.y * radius * 0.001
      };
    }
  }

  // If no bounded escape was found, attempt the nearest legal ball. Never
  // describe this as a clear route or bypass a foul in the real rules engine.
  if (!bestPot && !bestSafety) {
    const target = [...targets].sort(
      (a, b) => distance(cue.pos, a.pos) - distance(cue.pos, b.pos)
    )[0];
    const aim = direction(cue.pos, target.pos);
    if (aim)
      bestSafety = {
        type: 'safety',
        aimDir: aim,
        power: power(distance(cue.pos, target.pos)),
        target: target.color.toUpperCase(),
        targetId: target.id,
        pocketId: 'SAFETY',
        pocketCenter: null,
        cueToTarget: distance(cue.pos, target.pos),
        targetToPocket: 0,
        difficulty: span * 4,
        quality: 0,
        spin: { x: 0, y: 0 },
        viaCushion: false,
        route: [{ ...cue.pos }, { ...target.pos }],
        verifiedContact: false,
        source: 'tailuge'
      };
  }
  return { bestPot, bestSafety };
}

/** Cache only the last immutable layout; include rule phase and table geometry. */
export function createSnookerPlanner() {
  let previousKey = '';
  let previousResult: ShotOptions = empty();
  return (input: PlannerInput): ShotOptions => {
    const key = JSON.stringify([
      input.frame,
      input.cueId,
      input.radius,
      input.halfWidth,
      input.halfHeight,
      input.balls.map((b) => [b.id, b.color, b.active, b.pos.x, b.pos.y]),
      input.pockets
    ]);
    if (key !== previousKey) {
      previousResult = planSnookerShot(input);
      previousKey = key;
    }
    return previousResult;
  };
}
