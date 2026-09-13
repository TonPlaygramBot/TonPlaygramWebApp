/*!
 * @license
 * SPDX-License-Identifier: GPL-3.0-only
 * Adapted from tailuge/billiards src/network/bot/aimcalculator.ts
 * at e6ed0dba43e09177540f176ad7a62b1ef6f64415 (author: tailuge).
 * Changes: dependency-free 2D vectors, caller-owned radius/pockets, input guards.
 * See NOTICE.md and COPYING in this directory.
 */
export interface Point {
  x: number;
  y: number;
}

export const subtract = (a: Point, b: Point): Point => ({
  x: a.x - b.x,
  y: a.y - b.y
});
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
export const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const finitePoint = (p: Point): boolean =>
  Boolean(p && Number.isFinite(p.x) && Number.isFinite(p.y));
export function direction(from: Point, to: Point): Point | null {
  const length = distance(from, to);
  return length > 1e-9 && Number.isFinite(length)
    ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
    : null;
}

/** Tailuge's ghost-ball construction; the table's actual pocket mouth is supplied. */
export function ghostBallPosition(
  target: Point,
  pocket: Point,
  radius: number
): Point | null {
  const incident = direction(pocket, target);
  if (!incident || !(radius > 0)) return null;
  return {
    x: target.x + incident.x * radius * 2.001,
    y: target.y + incident.y * radius * 2.001
  };
}

/** Tailuge's cut-angle score. Lower is easier; backwards cuts are rejected by the planner. */
export function cutScore(cue: Point, target: Point, pocket: Point): number {
  const shot = direction(cue, target);
  const exit = direction(target, pocket);
  return shot && exit ? 1 - dot(shot, exit) : Infinity;
}

/** Earliest collision distance along a ray, including touching balls. */
export function rayBallDistance(
  origin: Point,
  aim: Point,
  center: Point,
  radius: number
): number | null {
  const delta = subtract(center, origin);
  const along = dot(delta, aim);
  const perpendicularSq = Math.max(0, dot(delta, delta) - along * along);
  const radiusSq = radius * radius;
  if (along < 0 || perpendicularSq > radiusSq) return null;
  return Math.max(
    0,
    along - Math.sqrt(Math.max(0, radiusSq - perpendicularSq))
  );
}
