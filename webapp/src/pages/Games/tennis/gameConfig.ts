export type PlayerSide = "near" | "far";
export type ServeCourtSide = "deuce" | "ad";
export type BallPhysicsState =
  | "Idle"
  | "ServeReady"
  | "Toss"
  | "ServeHit"
  | "InFlight"
  | "CourtBounce"
  | "RacketHitPlayer"
  | "RacketHitAI"
  | "NetHit"
  | "Out"
  | "DoubleBounce"
  | "PointEnded";

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

export type ShotType = "flat" | "topspin" | "slice" | "lob" | "drop" | "block";

const WORLD_SCALE = 1.2;

export const gameConfig = {
  worldScale: WORLD_SCALE,
  fixedTimeStep: 1 / 120,
  maxPhysicsSteps: 5,
  courtW: 7.45 * WORLD_SCALE,
  doublesW: 8.9 * WORLD_SCALE,
  courtL: 19.8 * WORLD_SCALE,
  serviceLineZ: 3.65 * WORLD_SCALE,
  courtPlaneY: 0,
  netHeight: 0.78 * WORLD_SCALE,
  ballRadius: 0.1 * WORLD_SCALE,
  gravity: 9.8,
  airDrag: 0.078,
  bounceDamping: 0.74,
  courtFriction: 0.86,
  minBallSpeed: 0.12 * WORLD_SCALE,
  playerHeight: 2.2 * WORLD_SCALE,
  playerSpeed: 7.1 * WORLD_SCALE,
  playerAcceleration: 32 * WORLD_SCALE,
  playerDeceleration: 38 * WORLD_SCALE,
  ai: {
    reactionTime: 0.18,
    movementSpeed: 11.6 * WORLD_SCALE,
    reachRadius: 1.45 * WORLD_SCALE,
    accuracy: 0.78,
    power: 0.82,
    spin: 0.55,
    mistakeChance: 0.11,
    serveQuality: 0.72,
  },
  racketHitRadius: 0.48 * WORLD_SCALE,
  contactAngleTolerance: 0.64,
  timingWindow: { start: 0.42, end: 0.72 },
  minContactHeight: 0.16,
  maxContactHeight: 1.62,
  maxReachDistance: 1.45 * WORLD_SCALE,
  swingDuration: 0.38,
  serveDuration: 0.86,
  serveContactT: 0.72,
  servePower: 1.0,
  shotPower: 1.0,
  spinAmount: 1.0,
  cameraDamping: 5.5,
  playerVisualYawFix: Math.PI,
  serveNearBaselineZ: 8.2 * WORLD_SCALE,
  serviceBuffer: 0.28 * WORLD_SCALE,
  scoring: { gamesToSet: 6, winByGames: 2 },
} as const;

export const tennisPointLabel = (point: number) => ["0", "15", "30", "40"][Math.max(0, Math.min(3, point))];

export const oppositeSide = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
