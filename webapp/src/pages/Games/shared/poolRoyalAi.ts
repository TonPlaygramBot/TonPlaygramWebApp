// SPDX-License-Identifier: GPL-3.0-only
// Port of tailuge/billiards AimCalculator and ClawBreak target selection.
// Pinned source and license: ../../../vendor/tailuge/NOTICE.md.
import { Vector2, Vector3 } from 'three';
import {
  PoolRoyalPhysics,
  POOL_FIXED_SECONDS,
  POOL_PHYSICS_REVISION,
  resolveMappedPoolCushion,
  type PoolBody
} from './poolRoyalPhysics';
import type { TableCalibration } from './poolRoyalTableGeometry';
import { resolvePoolRoyaleShotPowerScale } from '../poolRoyaleShotState.js';
import { separatePoolBalls } from '../poolRoyaleBallSeparation.js';

function powerForSpeed(speed: number, maxSpeed: number) {
  let low = 0,
    high = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    if (maxSpeed * resolvePoolRoyaleShotPowerScale(mid) < speed) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export type AiBall = PoolBody & { id: string | number };
export type TailugePlan = {
  type: 'pot' | 'safety';
  aimDir: Vector2;
  power: number;
  targetBall: AiBall;
  pocketIndex: number;
  pocketCenter: Vector2 | null;
  spin: { x: number; y: number };
  cueToTarget: number;
  targetToPocket: number;
  difficulty: number;
  quality: number;
  potChance: number;
  aiMeta: { source: string; simulated: boolean };
};

/** Upstream 2.001R ghost distance and 1-dot cut score, in the host table plane. */
export function tailugeGhostBall(
  target: Vector2,
  pocket: Vector2,
  radius: number
) {
  return target.clone().add(
    pocket
      .clone()
      .sub(target)
      .normalize()
      .multiplyScalar(-radius * 2.001)
  );
}
export function tailugeCutScore(
  cue: Vector2,
  target: Vector2,
  pocket: Vector2
) {
  return (
    1 -
    target
      .clone()
      .sub(cue)
      .normalize()
      .dot(pocket.clone().sub(target).normalize())
  );
}
function clearPath(
  from: Vector2,
  to: Vector2,
  balls: AiBall[],
  ignore: Set<string | number>,
  radius: number
) {
  const delta = to.clone().sub(from),
    length = delta.length();
  if (length < 1e-8) return false;
  delta.divideScalar(length);
  return balls.every((b) => {
    if (b.active === false || ignore.has(b.id)) return true;
    const offset = b.pos.clone().sub(from),
      along = offset.dot(delta);
    return (
      along <= 0 ||
      along >= length ||
      offset.addScaledVector(delta, -along).lengthSq() >= 4 * radius * radius
    );
  });
}

export function probeTailugeShot(
  balls: AiBall[],
  cueId: string | number,
  plan: TailugePlan,
  physics: PoolRoyalPhysics,
  mapping: TableCalibration,
  maxSpeed: number
) {
  const copies = balls
    .filter((b) => b.active !== false)
    .map((b) => ({
      ...b,
      pos: b.pos.clone(),
      vel: new Vector2(),
      omega: new Vector3(),
      active: true
    }));
  const cue = copies.find((b) => b.id === cueId)!;
  physics.strike(
    cue,
    plan.aimDir,
    maxSpeed * resolvePoolRoyaleShotPowerScale(plan.power),
    plan.spin
  );
  let firstHit: string | number | null = null,
    scratch = false,
    potted = false,
    targetPocketIndex = -1;
  for (let step = 0; step < 240 * 6; step++) {
    let moving = false;
    for (const b of copies) {
      if (!b.active || b.vel.lengthSq() + b.omega.lengthSq() < 1e-14) continue;
      physics.step(b, POOL_FIXED_SECONDS);
      if (b.vel.lengthSq() > 1e-10 || b.omega.lengthSq() > 1e-8) moving = true;
      const pocketIndex = mapping.pockets.findIndex(
        (p) => b.pos.distanceToSquared(p.center) < p.radius * p.radius
      );
      if (pocketIndex >= 0) {
        b.active = false;
        if (b.id === cueId) scratch = true;
        if (b.id === plan.targetBall.id) {
          potted = true;
          targetPocketIndex = pocketIndex;
        }
        continue;
      }
      const impact = resolveMappedPoolCushion(
        b,
        mapping.segments,
        physics.radius
      );
      if (impact) physics.cushion(b, impact.normal);
    }
    for (let i = 0; i < copies.length; i++)
      for (let j = i + 1; j < copies.length; j++) {
        const a = copies[i],
          b = copies[j];
        if (
          !a.active ||
          !b.active ||
          a.pos.distanceToSquared(b.pos) > (physics.radius * 2 + 1e-7) ** 2
        )
          continue;
        if (
          physics.collide(a, b) > 0 &&
          firstHit === null &&
          (a.id === cueId || b.id === cueId)
        )
          firstHit = a.id === cueId ? b.id : a.id;
        const d = a.pos.distanceTo(b.pos),
          overlap = physics.radius * 2 - d;
        if (overlap > 0 && d > 1e-8) {
          const n = b.pos
            .clone()
            .sub(a.pos)
            .multiplyScalar(overlap / (2 * d));
          a.pos.sub(n);
          b.pos.add(n);
        }
      }
    separatePoolBalls(copies, physics.radius * 2, 5);
    if (scratch || !moving) break;
  }
  return {
    potted:
      potted &&
      !scratch &&
      firstHit === plan.targetBall.id &&
      targetPocketIndex === plan.pocketIndex,
    scratch,
    firstHit,
    targetPocketIndex
  };
}

export function planTailugePoolShot({
  balls,
  cue,
  legal,
  physics,
  mapping,
  maxSpeed
}: {
  balls: AiBall[];
  cue: AiBall;
  legal: AiBall[];
  physics: PoolRoyalPhysics;
  mapping: TableCalibration;
  maxSpeed: number;
}): TailugePlan | null {
  const candidates: TailugePlan[] = [];
  // ClawBreak chooses the nearest valid ball. Legal targets come from the
  // existing UK/8-ball/9-ball rules, never from ball colour guesses here.
  const targets = legal
    .filter((b) => b.active !== false)
    .slice()
    .sort(
      (a, b) =>
        cue.pos.distanceToSquared(a.pos) - cue.pos.distanceToSquared(b.pos)
    );
  for (const target of targets)
    for (let index = 0; index < mapping.pockets.length; index++) {
      const pocket = mapping.pockets[index];
      const ghost = tailugeGhostBall(target.pos, pocket.center, physics.radius);
      const cut = tailugeCutScore(cue.pos, target.pos, pocket.center);
      if (
        cut > 0.9 ||
        !clearPath(
          cue.pos,
          ghost,
          balls,
          new Set([cue.id, target.id]),
          physics.radius
        ) ||
        !clearPath(
          target.pos,
          pocket.center,
          balls,
          new Set([cue.id, target.id]),
          physics.radius
        )
      )
        continue;
      const speed = (90 * physics.radius) / 60; // AimCalculator.DEFAULT_SHOT_POWER = 90 * R (m/s).
      candidates.push({
        type: 'pot',
        aimDir: ghost.clone().sub(cue.pos).normalize(),
        power: powerForSpeed(speed, maxSpeed),
        targetBall: target,
        pocketIndex: index,
        pocketCenter: pocket.center.clone(),
        spin: { x: 0, y: 0 },
        cueToTarget: cue.pos.distanceTo(ghost),
        targetToPocket: target.pos.distanceTo(pocket.center),
        difficulty: cut,
        quality: 1 - cut,
        potChance: 0,
        aiMeta: { source: POOL_PHYSICS_REVISION, simulated: false }
      });
    }
  candidates.sort(
    (a, b) => a.difficulty - b.difficulty || a.cueToTarget - b.cueToTarget
  );
  // Check a bounded shortlist using the same SI engine and measured cushions.
  // Cache this result in the host until balls or the legal-target set change.
  for (const candidate of candidates.slice(0, 6)) {
    for (const offset of [0, -0.012, 0.012, -0.024, 0.024]) {
      const plan = {
        ...candidate,
        aimDir: candidate.aimDir.clone().rotateAround(new Vector2(), offset)
      };
      const result = probeTailugeShot(
        balls,
        cue.id,
        plan,
        physics,
        mapping,
        maxSpeed
      );
      if (result.potted)
        return {
          ...plan,
          potChance: 1,
          aiMeta: { source: POOL_PHYSICS_REVISION, simulated: true }
        };
    }
  }
  const target =
    targets.find((b) =>
      clearPath(cue.pos, b.pos, balls, new Set([cue.id, b.id]), physics.radius)
    ) ?? targets[0];
  if (!target) return null;
  return {
    type: 'safety',
    aimDir: target.pos.clone().sub(cue.pos).normalize(),
    power: powerForSpeed((90 * physics.radius) / 60, maxSpeed),
    targetBall: target,
    pocketIndex: -1,
    pocketCenter: null,
    spin: { x: 0, y: 0 },
    cueToTarget: cue.pos.distanceTo(target.pos),
    targetToPocket: 0,
    difficulty: 1,
    quality: 0,
    potChance: 0,
    aiMeta: { source: POOL_PHYSICS_REVISION, simulated: false }
  };
}
