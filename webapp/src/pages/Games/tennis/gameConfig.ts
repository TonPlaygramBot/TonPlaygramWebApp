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

const WORLD_SCALE = 1.55;

export const gameConfig = {
  worldScale: WORLD_SCALE,
  fixedTimeStep: 1 / 90,
  maxPhysicsSteps: 5,
  // Regulation court proportions in world metres, scaled as a single unit so
  // the court, net, players, rackets and ball read correctly against HDRIs.
  courtW: 8.23 * WORLD_SCALE,
  doublesW: 10.97 * WORLD_SCALE,
  courtL: 23.77 * WORLD_SCALE,
  serviceLineZ: 6.4 * WORLD_SCALE,
  netH: 0.914 * WORLD_SCALE,
  ballR: 0.085 * WORLD_SCALE,
  gravity: 9.8,
  airDrag: 0.078,
  bounceRestitution: 0.74,
  groundFriction: 0.86,
  minBallSpeed: 0.12 * WORLD_SCALE,
  courtFriction: 0.86,
  playerHeight: 1.88 * WORLD_SCALE,
  playerSpeed: 8.4 * WORLD_SCALE,
  playerAcceleration: 28 * WORLD_SCALE,
  playerDeceleration: 34 * WORLD_SCALE,
  aiSpeed: 11.2 * WORLD_SCALE,
  reach: 1.62 * WORLD_SCALE,
  racketHitRadius: 0.56 * WORLD_SCALE,
  contactAngleTolerance: 0.18,
  timingWindow: { start: 0.42, end: 0.72 },
  minContactHeight: 0.25 * WORLD_SCALE,
  maxContactHeight: 1.85 * WORLD_SCALE,
  maxReachDistance: 1.62 * WORLD_SCALE,
  swingDuration: 0.38,
  serveDuration: 0.86,
  serveContactT: 0.72,
  serveTossMinHeight: 1.85 * WORLD_SCALE,
  servePower: { min: 0.72, max: 1 },
  shotPower: { min: 0.35, max: 1 },
  spinAmount: { flat: 0.8, topspin: 1.6, slice: -1.4, lob: 1.1, drop: -0.7, block: 0.25 },
  playerVisualYawFix: Math.PI,
  serveNearBaselineZ: (23.77 / 2 + 0.92) * WORLD_SCALE,
  serviceBuffer: 0.28 * WORLD_SCALE,
  cameraDamping: 5.5,
  scoring: { gamesPerSet: 6, winByTwoGames: true },
  aiDifficulty: {
    reactionTime: 0.14,
    moveSpeed: 11.2 * WORLD_SCALE,
    reachRadius: 1.7 * WORLD_SCALE,
    accuracy: 0.88,
    power: 0.94,
    spin: 0.72,
    mistakeChance: 0.045,
    serveQuality: 0.84,
  },
} as const;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
export const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
