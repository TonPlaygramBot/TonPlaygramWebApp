import * as THREE from "three";

export type PlayerSide = "near" | "far";
export type BallStateName =
  | "idle"
  | "serve"
  | "flying"
  | "tableBouncePlayer"
  | "tableBounceAI"
  | "paddleHitPlayer"
  | "paddleHitAI"
  | "netHit"
  | "out"
  | "pointEnded";
export type ShotType = "forehand drive" | "backhand drive" | "push" | "brush/topspin" | "lob";
export type PointReason = "out" | "doubleBounce" | "net" | "missedReturn" | "netFault" | "wrongSide";

export const gameConfig = {
  fixedDt: 1 / 120,
  maxSubSteps: 5,
  table: {
    length: 5.8,
    width: 3.2,
    topY: 1.45,
    thickness: 0.075,
    restitution: 0.91,
    friction: 0.965,
  },
  net: {
    height: 0.1525,
    thickness: 0.018,
    postOutside: 0.1525,
    restitution: 0.2,
  },
  ball: {
    radius: 0.038,
    gravity: 9.81,
    drag: 0.2,
    magnus: 0.00115,
    spinDecay: 0.72,
    minSpeed: 3.5,
    maxSpeed: 10.2,
  },
  player: {
    height: 1.65,
    moveSpeed: 3.35,
    safeXInset: 0.18,
    nearZMinPad: 0.22,
    nearZMaxPad: 0.95,
    hitRecovery: 0.24,
  },
  paddle: {
    radius: 0.19,
    visualRadius: 0.13,
    hitAngleCos: 0.18,
    timingWindow: 0.18,
    handOffset: new THREE.Vector3(0.24, 1.18, -0.22),
  },
  ai: {
    reactionTime: 0.2,
    moveSpeed: 3.25,
    accuracy: 0.78,
    shotPower: 0.72,
    mistakeChance: 0.12,
    maxReach: 0.72,
  },
  camera: {
    portraitFov: 48,
    landscapeFov: 42,
    damping: 7,
  },
  replay: {
    seconds: 1.35,
    slowMotion: 0.35,
    maxFrames: 420,
  },
} as const;

export const TABLE_HALF_W = gameConfig.table.width / 2;
export const TABLE_HALF_L = gameConfig.table.length / 2;
export const BALL_SURFACE_Y = gameConfig.table.topY + gameConfig.ball.radius;
export const UP = new THREE.Vector3(0, 1, 0);

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function clamp01(v: number) {
  return clamp(v, 0, 1);
}

export function sideForZ(z: number): PlayerSide {
  return z >= 0 ? "near" : "far";
}

export function opponent(side: PlayerSide): PlayerSide {
  return side === "near" ? "far" : "near";
}

export function isInsideTableTop(x: number, z: number, margin = 0) {
  return Math.abs(x) <= TABLE_HALF_W + margin && Math.abs(z) <= TABLE_HALF_L + margin;
}

export function isInsideSide(side: PlayerSide, x: number, z: number, margin = 0) {
  if (!isInsideTableTop(x, z, margin)) return false;
  return side === "near" ? z >= -margin : z <= margin;
}

export function ballisticVelocity(from: THREE.Vector3, to: THREE.Vector3, flightTime: number) {
  const dt = Math.max(0.08, flightTime);
  return new THREE.Vector3(
    (to.x - from.x) / dt,
    (to.y - from.y + 0.5 * gameConfig.ball.gravity * dt * dt) / dt,
    (to.z - from.z) / dt
  );
}
