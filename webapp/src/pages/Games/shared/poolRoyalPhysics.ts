// SPDX-License-Identifier: GPL-3.0-only
// Adapter for the pinned tailuge/billiards engine; see ../../../vendor/tailuge/NOTICE.md.
import { Vector2, Vector3 } from 'three';
import { Ball, State } from '../../../vendor/tailuge/model/ball';
import { Collision } from '../../../vendor/tailuge/model/physics/collision';
import {
  bounceHanBlend,
  cueStrike,
  rotateApplyUnrotate
} from '../../../vendor/tailuge/model/physics/physics';
import {
  setR,
  setm,
  setmu
} from '../../../vendor/tailuge/model/physics/constants';
import type { TableSegment } from './poolRoyalTableGeometry';

export const POOL_PHYSICS_REVISION = 'tailuge-c85f0476';
export const POOL_FIXED_SECONDS = 1 / 240;
export const POOL_FRAME_SECONDS = 1 / 60;
export const POOL_BALL_RADIUS_METRES = 0.028575;
export type PoolBody = {
  pos: Vector2;
  vel: Vector2;
  omega: Vector3;
  active?: boolean;
};

// The game stores travel per 60 Hz frame. SI conversion happens at this boundary,
// including angular velocity. The proper rotation (x,-z,y) preserves handedness.
setR(POOL_BALL_RADIUS_METRES);
setm(0.17);
setmu(0.007); // TableGeometry.configureForRule: upstream pocket-table cloth.

export class PoolRoyalPhysics {
  readonly metresPerUnit: number;
  private readonly a = new Ball(new Vector3());
  private readonly b = new Ball(new Vector3());
  private readonly states = new WeakMap<PoolBody, State>();
  constructor(readonly radius: number) {
    if (!(radius > 0)) throw new Error('A positive ball radius is required');
    this.metresPerUnit = POOL_BALL_RADIUS_METRES / radius;
  }
  private read(body: PoolBody, ball = this.a) {
    const s = this.metresPerUnit;
    ball.pos.set(body.pos.x * s, -body.pos.y * s, 0);
    ball.vel.set(body.vel.x * s * 60, -body.vel.y * s * 60, 0);
    ball.rvel.set(body.omega.x * 60, -body.omega.z * 60, body.omega.y * 60);
    const moving = ball.vel.lengthSq() + ball.rvel.lengthSq() > 1e-14;
    ball.state = moving
      ? (this.states.get(body) ?? State.Sliding)
      : State.Stationary;
    if (moving && ball.state === State.Stationary) ball.state = State.Sliding;
    return ball;
  }
  private write(ball: Ball, body: PoolBody, position = false) {
    const s = this.metresPerUnit;
    if (position) body.pos.set(ball.pos.x / s, -ball.pos.y / s);
    body.vel.set(ball.vel.x / (s * 60), -ball.vel.y / (s * 60));
    body.omega.set(ball.rvel.x / 60, ball.rvel.z / 60, -ball.rvel.y / 60);
    this.states.set(body, ball.state);
  }
  step(body: PoolBody, dt: number) {
    if (!Number.isFinite(dt) || dt <= 0 || body.active === false) return;
    const ball = this.read(body);
    ball.update(dt);
    this.write(ball, body, true);
  }
  strike(
    body: PoolBody,
    direction: Vector2,
    speed: number,
    spin: { x: number; y: number },
    elevation = 0
  ) {
    const ball = this.read(body);
    const tip = new Vector3(-spin.x * 0.6, spin.y * 0.6, 0).clampLength(
      0,
      0.45
    );
    const result = cueStrike(
      Math.atan2(-direction.y, direction.x),
      speed * this.metresPerUnit * 60,
      tip,
      elevation
    );
    ball.vel.copy(result.vel);
    ball.rvel.copy(result.rvel);
    ball.state = State.Sliding;
    this.write(ball, body);
  }
  cushion(body: PoolBody, normal: Vector2) {
    if (body.vel.dot(normal) >= 0) return;
    const ball = this.read(body);
    // Han expects travel toward a +X cushion; normal points into the cloth.
    const rotation = -Math.atan2(normal.y, -normal.x);
    const delta = rotateApplyUnrotate(
      rotation,
      ball.vel,
      ball.rvel,
      bounceHanBlend
    );
    ball.vel.add(delta.v);
    ball.rvel.add(delta.w);
    ball.state = State.Sliding;
    this.write(ball, body);
  }
  collide(a: PoolBody, b: PoolBody) {
    if (
      (a.vel.x - b.vel.x) * (b.pos.x - a.pos.x) +
        (a.vel.y - b.vel.y) * (b.pos.y - a.pos.y) <=
      0
    )
      return 0;
    this.read(a, this.a);
    this.read(b, this.b);
    const impact = Collision.collide(this.a, this.b);
    this.write(this.a, a);
    this.write(this.b, b);
    return (Math.abs(impact) / (this.metresPerUnit * 60)) * 0.17;
  }
}

/** Bounded fixed-step accumulator. Refresh-rate selection never changes dt. */
export class PoolRoyalPhysicsClock {
  private accumulator = 0;
  advance(elapsedMs: number) {
    this.accumulator += Math.min(
      0.1,
      Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs / 1000 : 0)
    );
    const steps = Math.min(
      24,
      Math.floor((this.accumulator + 1e-10) / POOL_FIXED_SECONDS)
    );
    this.accumulator = Math.max(
      0,
      this.accumulator - steps * POOL_FIXED_SECONDS
    );
    return {
      physicsSubsteps: steps,
      subStepScale: POOL_FIXED_SECONDS / POOL_FRAME_SECONDS,
      frameScale: (steps * POOL_FIXED_SECONDS) / POOL_FRAME_SECONDS
    };
  }
  reset() {
    this.accumulator = 0;
  }
}

/** One contact implementation is shared by live play and AI shot probes. */
export function resolveMappedPoolCushion(
  body: PoolBody,
  segments: TableSegment[],
  radius: number
) {
  let best: { normal: Vector2; type: string; penetration: number } | null =
    null;
  for (const s of segments) {
    const x = body.pos.x,
      y = body.pos.y;
    if (
      x < Math.min(s.start.x, s.end.x) - radius ||
      x > Math.max(s.start.x, s.end.x) + radius ||
      y < Math.min(s.start.y, s.end.y) - radius ||
      y > Math.max(s.start.y, s.end.y) + radius
    )
      continue;
    if (body.vel.dot(s.normal) >= 0) continue;
    const dx = s.end.x - s.start.x,
      dy = s.end.y - s.start.y,
      len = dx * dx + dy * dy;
    if (len < 1e-14) continue;
    const t = Math.max(
      0,
      Math.min(1, ((x - s.start.x) * dx + (y - s.start.y) * dy) / len)
    );
    const nx = x - s.start.x - t * dx,
      ny = y - s.start.y - t * dy,
      d = Math.hypot(nx, ny);
    if (d >= radius) continue;
    const normal = d > 1e-8 ? new Vector2(nx / d, ny / d) : s.normal.clone();
    if (normal.dot(s.normal) < 0) normal.negate();
    const penetration = radius - d;
    if (!best || penetration > best.penetration)
      best = { normal, type: s.type, penetration };
  }
  if (!best) return null;
  const preImpactVel = body.vel.clone();
  body.pos.addScaledVector(best.normal, best.penetration);
  return {
    ...best,
    preImpactVel,
    tangent: new Vector2(-best.normal.y, best.normal.x)
  };
}

/** Ray against the same finite cushion faces and rounded endpoint contacts. */
export function traceMappedPoolCushion(
  origin: Vector2,
  direction: Vector2,
  segments: TableSegment[],
  radius: number
): { distance: number; normal: Vector2 } | null {
  const dir = direction.clone().normalize();
  let closest: { distance: number; normal: Vector2 } | null = null;
  const accept = (distance: number, normal: Vector2) => {
    if (
      distance >= 0 &&
      dir.dot(normal) < 0 &&
      (!closest || distance < closest.distance)
    )
      closest = { distance, normal };
  };
  for (const segment of segments) {
    const { start, end, normal } = segment;
    const incoming = dir.dot(normal);
    if (incoming >= -1e-10) continue;
    const edge = end.clone().sub(start),
      lengthSq = edge.lengthSq();
    if (lengthSq < 1e-14) continue;
    const distance =
      (start.clone().sub(origin).dot(normal) + radius) / incoming;
    const hit = origin.clone().addScaledVector(dir, distance);
    const along = hit.clone().sub(start).dot(edge) / lengthSq;
    if (along >= 0 && along <= 1) accept(distance, normal.clone());
    for (const endpoint of [start, end]) {
      const offset = endpoint.clone().sub(origin),
        projection = offset.dot(dir);
      const discriminant =
        radius * radius - (offset.lengthSq() - projection * projection);
      if (discriminant < 0) continue;
      const t = projection - Math.sqrt(discriminant);
      const radial = origin
        .clone()
        .addScaledVector(dir, t)
        .sub(endpoint)
        .normalize();
      if (radial.dot(normal) >= 0) accept(t, radial);
    }
  }
  return closest;
}
