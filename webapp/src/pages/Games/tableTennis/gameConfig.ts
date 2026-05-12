import * as THREE from "three";

export type PlayerSide = "near" | "far";
export type PointReason = "out" | "doubleBounce" | "net" | "wrongSide" | "miss";
export type StrokeAction = "ready" | "forehand" | "backhand" | "serve";
export type ServeStage = "own" | "opponent";
export type AiTactic = "serve" | "loop" | "drive" | "push" | "wide" | "body" | "lob";
export type BallPhysicsStateName =
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

export type BallPhase =
  | { kind: "serve"; server: PlayerSide; stage: ServeStage }
  | { kind: "rally" };

export type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
  phase: BallPhase;
  stateName: BallPhysicsStateName;
  sideBounceCounts: Record<PlayerSide, number>;
};

export type DesiredHit = {
  target: THREE.Vector3;
  power: number;
  topSpin: number;
  sideSpin: number;
  tactic?: AiTactic;
};

export type DifficultyConfig = {
  reactionTime: number;
  moveSpeed: number;
  accuracy: number;
  shotPower: number;
  mistakeChance: number;
  maxReach: number;
};

export const UP = new THREE.Vector3(0, 1, 0);
export const Y_AXIS = UP;

export const CFG = {
  tableL: 5.8,
  tableW: 3.2,
  tableY: 1.45,
  tableTopThickness: 0.075,
  netH: 0.1525,
  netPostOutside: 0.1525,
  ballR: 0.038,
  gravity: 9.81,
  fixedDt: 1 / 120,
  maxSubSteps: 5,
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
  paddleHitRadius: 0.34,
  paddleMaxFaceAngle: 0.74,
  paddleTimingGrace: 0.04,
  playerSafeZMargin: 0.22,
  aiDifficulty: {
    reactionTime: 0.24,
    moveSpeed: 3.35,
    accuracy: 0.83,
    shotPower: 0.86,
    mistakeChance: 0.13,
    maxReach: 0.9,
  } satisfies DifficultyConfig,
};

export const TABLE_REFERENCE_LENGTH = 2.74;
export const TABLE_SCALE_FACTOR = CFG.tableL / TABLE_REFERENCE_LENGTH;
export const PADDLE_SCALE_FACTOR = Math.max(1, TABLE_SCALE_FACTOR * 0.78);
export const TABLE_HALF_W = CFG.tableW / 2;
export const TABLE_HALF_L = CFG.tableL / 2;
export const BALL_SURFACE_Y = CFG.tableY + CFG.ballR;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
export const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
export const isOverTable = (x: number, z: number, margin = 0) => Math.abs(x) <= TABLE_HALF_W + margin && Math.abs(z) <= TABLE_HALF_L + margin;
