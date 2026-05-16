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

const BASE_WORLD_SCALE = 1.72;
const COURT_AND_CHARACTER_SIZE_MULTIPLIER = 3.15;
const WORLD_SCALE = BASE_WORLD_SCALE * COURT_AND_CHARACTER_SIZE_MULTIPLIER;
// Keep camera scaling independent from world scale so camera framing can be
// tuned precisely while the enlarged court keeps its regulation proportions.
const CAMERA_VIEW_SCALE = BASE_WORLD_SCALE * 1.34;
// Extra character scale keeps human avatars visibly bigger than the court uplift.
const PLAYER_CHARACTER_SCALE = 1.35;
const PLAYER_SCALE = WORLD_SCALE * PLAYER_CHARACTER_SCALE;

export const gameConfig = {
  worldScale: WORLD_SCALE,
  courtAndCharacterSizeMultiplier: COURT_AND_CHARACTER_SIZE_MULTIPLIER,
  cameraViewScale: CAMERA_VIEW_SCALE,
  fixedTimeStep: 1 / 90,
  maxPhysicsSteps: 5,
  // Regulation court proportions in world metres, scaled as a single unit so
  // the tennis play area reads larger and more arena-like against HDRIs.
  courtW: 8.23 * WORLD_SCALE,
  doublesW: 10.97 * WORLD_SCALE,
  courtL: 23.77 * WORLD_SCALE,
  serviceLineZ: 6.4 * WORLD_SCALE,
  netH: 0.914 * WORLD_SCALE,
  ballR: 0.085 * WORLD_SCALE,
  // Gravity scales with the enlarged court so arcs land naturally instead of floating.
  gravity: 8.65 * WORLD_SCALE,
  airDrag: 0.086,
  bounceRestitution: 0.58,
  groundFriction: 0.74,
  minBallSpeed: 0.12 * WORLD_SCALE,
  courtFriction: 0.78,
  playerHeight: 1.88 * PLAYER_SCALE,
  playerSpeed: 8.9 * PLAYER_SCALE,
  playerAcceleration: 28 * PLAYER_SCALE,
  playerDeceleration: 34 * PLAYER_SCALE,
  aiSpeed: 11.8 * PLAYER_SCALE,
  reach: 1.62 * PLAYER_SCALE,
  racketHitRadius: 0.56 * PLAYER_SCALE,
  contactAngleTolerance: 0.18,
  timingWindow: { start: 0.42, end: 0.72 },
  minContactHeight: 0.25 * PLAYER_SCALE,
  maxContactHeight: 1.85 * PLAYER_SCALE,
  maxReachDistance: 1.62 * PLAYER_SCALE,
  swingDuration: 0.38,
  serveDuration: 0.86,
  serveContactT: 0.72,
  serveTossMinHeight: 1.85 * PLAYER_SCALE,
  // Scales the full match shot force so player and AI strokes share a softer, lower power ceiling.
  matchPowerMultiplier: 0.72,
  servePower: { min: 0.48, max: 0.74 },
  shotPower: { min: 0.22, max: 0.72 },
  spinAmount: { flat: 0.8, topspin: 1.6, slice: -1.4, lob: 1.1, drop: -0.7, block: 0.25 },
  playerVisualYawFix: Math.PI,
  serveNearBaselineZ: (23.77 / 2 + 0.92) * WORLD_SCALE,
  serviceBuffer: 0.28 * WORLD_SCALE,
  cameraDamping: 5.5,
  cameraBallLookAhead: 0.58,
  cameraPlayerFollowBlend: 0.72,
  playerAutoChase: {
    enabled: true,
    anticipation: 0.74,
    maxBlendPerSecond: 5.8,
  },
  scoring: { gamesPerSet: 6, winByTwoGames: true },
  aiDifficulty: {
    reactionTime: 0.07,
    moveSpeed: 13.6 * PLAYER_SCALE,
    reachRadius: 1.95 * PLAYER_SCALE,
    accuracy: 0.94,
    power: 0.66,
    spin: 0.88,
    mistakeChance: 0.018,
    serveQuality: 0.84,
  },
} as const;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
export const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
