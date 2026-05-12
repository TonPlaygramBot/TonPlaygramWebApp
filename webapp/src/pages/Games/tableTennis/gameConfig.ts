import * as THREE from "three";

export type PlayerSide = "near" | "far";
export type PointReason = "out" | "doubleBounce" | "net" | "wrongSide" | "miss";
export type StrokeAction = "ready" | "forehand" | "backhand" | "serve";
export type ServeStage = "own" | "opponent";
export type BallMotionState =
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

export const TABLE_TENNIS_CONFIG = {
  tableL: 5.8,
  tableW: 3.2,
  tableY: 1.45,
  tableTopThickness: 0.075,
  netH: 0.1525,
  netPostOutside: 0.1525,
  netThickness: 0.016,
  ballR: 0.038,
  gravity: 9.81,
  airDrag: 0.22,
  magnus: 0.00125,
  tableRestitution: 0.9,
  tableFriction: 0.965,
  spinDecay: 0.72,
  playerHeight: 2.9,
  playerSpeed: 3.35,
  aiSpeed: 3.45,
  reach: 0.82,
  swingDuration: 0.34,
  backhandDuration: 0.29,
  serveDuration: 0.86,
  hitWindowStart: 0.43,
  hitWindowEnd: 0.72,
  serveContactT: 0.68,
  netTopRestitution: 0.34,
  netFaceRestitution: 0.18,
  netPowerRetention: 0.2,
  bodyPowerRetention: 0.2,
  floorRestitution: 0.56,
  floorFriction: 0.88,
  railRestitution: 0.5,
  minShotSpeed: 3.7,
  maxShotSpeed: 9.8,
  playerVisualYawFix: Math.PI,
  paddlePalmOffset: 0.038,
  physicsStep: 1 / 120,
  maxPhysicsSteps: 5,
  hitRadius: 0.255,
  hitAngleDot: 0.16,
  hitTimingPad: 0.025,
  playerSafeX: 0.82,
  playerNearZMin: 0.18,
  playerNearZMax: 0.9,
} as const;

export const TABLE_REFERENCE_LENGTH = 2.74;
export const TABLE_SCALE_FACTOR = TABLE_TENNIS_CONFIG.tableL / TABLE_REFERENCE_LENGTH;
export const PADDLE_SCALE_FACTOR = Math.max(1, TABLE_SCALE_FACTOR * 0.78);
export const TABLE_HALF_W = TABLE_TENNIS_CONFIG.tableW / 2;
export const TABLE_HALF_L = TABLE_TENNIS_CONFIG.tableL / 2;
export const BALL_SURFACE_Y = TABLE_TENNIS_CONFIG.tableY + TABLE_TENNIS_CONFIG.ballR;
export const UP = new THREE.Vector3(0, 1, 0);
export const Y_AXIS = UP;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
export const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
export const isOverTable = (x: number, z: number, margin = 0) => Math.abs(x) <= TABLE_HALF_W + margin && Math.abs(z) <= TABLE_HALF_L + margin;

export function reduceImpactPower(velocity: THREE.Vector3, keepRatio: number, minSpeed = 0.35) {
  const speed = velocity.length();
  if (speed <= 0.0001) return;
  const capped = Math.max(minSpeed, speed * clamp(keepRatio, 0.05, 1));
  velocity.multiplyScalar(capped / speed);
}

export function chooseServerAfterScore(nearScore: number, farScore: number): PlayerSide {
  const total = nearScore + farScore;
  // Table tennis alternates every two points until deuce. The simplified match
  // keeps the existing two-serve cadence and is safe for mobile rally loops.
  return Math.floor(total / 2) % 2 === 0 ? "near" : "far";
}
