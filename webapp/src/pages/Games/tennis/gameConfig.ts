export type PlayerSide = "near" | "far";
export type ServeSide = "deuce" | "ad";
export type ShotTechnique = "flat" | "topspin" | "slice" | "lob" | "drop" | "block";
export type FootworkState =
  | "IdleReady"
  | "SplitStep"
  | "MoveLeft"
  | "MoveRight"
  | "MoveForward"
  | "MoveBack"
  | "Forehand"
  | "Backhand"
  | "Serve"
  | "Recover";

export enum TennisBallState {
  Idle = "Idle",
  ServeReady = "ServeReady",
  Toss = "Toss",
  ServeHit = "ServeHit",
  InFlight = "InFlight",
  CourtBounce = "CourtBounce",
  RacketHitPlayer = "RacketHitPlayer",
  RacketHitAI = "RacketHitAI",
  NetHit = "NetHit",
  Out = "Out",
  DoubleBounce = "DoubleBounce",
  PointEnded = "PointEnded",
}

const WORLD_SCALE = 1;

export const gameConfig = {
  worldScale: WORLD_SCALE,
  fixedTimeStep: 1 / 90,
  maxPhysicsSteps: 5,
  courtW: 8.23 * WORLD_SCALE,
  doublesW: 10.97 * WORLD_SCALE,
  courtL: 23.77 * WORLD_SCALE,
  serviceLineZ: 6.4 * WORLD_SCALE,
  netH: 0.914 * WORLD_SCALE,
  ballR: 0.075 * WORLD_SCALE,
  gravity: 9.8,
  airDrag: 0.078,
  bounceRestitution: 0.74,
  groundFriction: 0.86,
  minBallSpeed: 0.12 * WORLD_SCALE,
  courtFriction: 0.86,
  playerHeight: 1.84 * WORLD_SCALE,
  playerSpeed: 7.8 * WORLD_SCALE,
  playerAcceleration: 30 * WORLD_SCALE,
  playerDeceleration: 36 * WORLD_SCALE,
  aiSpeed: 8.9 * WORLD_SCALE,
  reach: 1.72 * WORLD_SCALE,
  racketHitRadius: 0.62 * WORLD_SCALE,
  contactAngleTolerance: 0.18,
  timingWindow: { start: 0.42, end: 0.72 },
  minContactHeight: 0.25,
  maxContactHeight: 2.35 * WORLD_SCALE,
  maxReachDistance: 1.95 * WORLD_SCALE,
  swingDuration: 0.38,
  serveDuration: 0.86,
  serveContactT: 0.72,
  serveTossMinHeight: 2.35 * WORLD_SCALE,
  servePower: { min: 0.72, max: 1 },
  shotPower: { min: 0.35, max: 1 },
  spinAmount: { flat: 0.8, topspin: 1.6, slice: -1.4, lob: 1.1, drop: -0.7, block: 0.25 },
  playerVisualYawFix: Math.PI,
  serveNearBaselineZ: 12.72 * WORLD_SCALE,
  serviceBuffer: 0.28 * WORLD_SCALE,
  cameraDamping: 5.5,
  scoring: { gamesPerSet: 6, winByTwoGames: true },
  aiDifficulty: {
    reactionTime: 0.14,
    moveSpeed: 8.9 * WORLD_SCALE,
    reachRadius: 1.72 * WORLD_SCALE,
    accuracy: 0.88,
    power: 0.86,
    spin: 0.72,
    mistakeChance: 0.045,
    serveQuality: 0.86,
  },
} as const;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
export const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
