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

const WORLD_SCALE = 1.2;

export const gameConfig = {
  worldScale: WORLD_SCALE,
  fixedTimeStep: 1 / 90,
  maxPhysicsSteps: 5,
  courtW: 7.45 * WORLD_SCALE,
  doublesW: 8.9 * WORLD_SCALE,
  courtL: 19.8 * WORLD_SCALE,
  serviceLineZ: 3.65 * WORLD_SCALE,
  netH: 0.78 * WORLD_SCALE,
  ballR: 0.1 * WORLD_SCALE,
  gravity: 9.8,
  airDrag: 0.078,
  bounceRestitution: 0.74,
  groundFriction: 0.86,
  minBallSpeed: 0.12 * WORLD_SCALE,
  courtFriction: 0.86,
  playerHeight: 2.2 * WORLD_SCALE,
  playerSpeed: 7.1 * WORLD_SCALE,
  playerAcceleration: 28 * WORLD_SCALE,
  playerDeceleration: 34 * WORLD_SCALE,
  aiSpeed: 11.6 * WORLD_SCALE,
  reach: 1.45 * WORLD_SCALE,
  racketHitRadius: 0.48 * WORLD_SCALE,
  contactAngleTolerance: 0.18,
  timingWindow: { start: 0.42, end: 0.72 },
  minContactHeight: 0.25,
  maxContactHeight: 1.85,
  maxReachDistance: 1.45 * WORLD_SCALE,
  swingDuration: 0.38,
  serveDuration: 0.86,
  serveContactT: 0.72,
  serveTossMinHeight: 1.85 * WORLD_SCALE,
  servePower: { min: 0.72, max: 1 },
  shotPower: { min: 0.35, max: 1 },
  spinAmount: { flat: 0.8, topspin: 1.6, slice: -1.4, lob: 1.1, drop: -0.7, block: 0.25 },
  playerVisualYawFix: Math.PI,
  serveNearBaselineZ: 8.2 * WORLD_SCALE,
  serviceBuffer: 0.28 * WORLD_SCALE,
  cameraDamping: 5.5,
  scoring: { gamesPerSet: 6, winByTwoGames: true },
  aiDifficulty: {
    reactionTime: 0.22,
    moveSpeed: 11.6 * WORLD_SCALE,
    reachRadius: 1.35 * WORLD_SCALE,
    accuracy: 0.76,
    power: 0.82,
    spin: 0.65,
    mistakeChance: 0.1,
    serveQuality: 0.72,
  },
} as const;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
export const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
