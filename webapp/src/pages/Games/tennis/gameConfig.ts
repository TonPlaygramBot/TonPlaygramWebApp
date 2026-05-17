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
const COURT_AND_CHARACTER_SIZE_MULTIPLIER = 4.12;
const COURT_WIDTH_MULTIPLIER = 1.28;
const WORLD_SCALE = BASE_WORLD_SCALE * COURT_AND_CHARACTER_SIZE_MULTIPLIER;
// Keep camera scaling independent from world scale so camera framing can be
// tuned precisely while the enlarged court keeps its regulation proportions.
const CAMERA_VIEW_SCALE = BASE_WORLD_SCALE * 1.62;
// Extra character scale keeps human avatars visibly bigger than the court uplift.
const PLAYER_CHARACTER_SCALE = 1.42;
const PLAYER_SCALE = WORLD_SCALE * PLAYER_CHARACTER_SCALE;

export const gameConfig = {
  worldScale: WORLD_SCALE,
  courtAndCharacterSizeMultiplier: COURT_AND_CHARACTER_SIZE_MULTIPLIER,
  courtWidthMultiplier: COURT_WIDTH_MULTIPLIER,
  cameraViewScale: CAMERA_VIEW_SCALE,
  fixedTimeStep: 1 / 90,
  maxPhysicsSteps: 5,
  // Regulation court proportions in world metres, scaled as a single unit so
  // the tennis play area reads larger and more arena-like against HDRIs.
  courtW: 8.23 * WORLD_SCALE * COURT_WIDTH_MULTIPLIER,
  doublesW: 10.97 * WORLD_SCALE * COURT_WIDTH_MULTIPLIER,
  courtL: 23.77 * WORLD_SCALE,
  serviceLineZ: 6.4 * WORLD_SCALE,
  netH: 1.12 * WORLD_SCALE,
  ballR: 0.085 * WORLD_SCALE,
  gravity: 9.81 * WORLD_SCALE * 1.04,
  airDrag: 0.13,
  bounceRestitution: 0.61,
  groundFriction: 0.74,
  minBallSpeed: 0.12 * WORLD_SCALE,
  courtFriction: 0.74,
  playerHeight: 1.88 * PLAYER_SCALE,
  playerSpeed: 8.9 * PLAYER_SCALE,
  playerAcceleration: 28 * PLAYER_SCALE,
  playerDeceleration: 34 * PLAYER_SCALE,
  aiSpeed: 11.7 * PLAYER_SCALE,
  reach: 1.62 * PLAYER_SCALE,
  racketHitRadius: 0.17 * PLAYER_SCALE,
  contactAngleTolerance: 0.08,
  timingWindow: { start: 0.46, end: 0.66 },
  minContactHeight: 0.25 * PLAYER_SCALE,
  maxContactHeight: 1.85 * PLAYER_SCALE,
  maxReachDistance: 1.62 * PLAYER_SCALE,
  swingDuration: 0.42,
  serveDuration: 0.86,
  serveContactT: 0.72,
  serveTossMinHeight: 1.85 * PLAYER_SCALE,
  // Scales the full match shot force so player and AI strokes share a softer, lower power ceiling.
  matchPowerMultiplier: 0.68,
  servePower: { min: 0.48, max: 0.74 },
  shotPower: { min: 0.2, max: 0.68 },
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
    moveSpeed: 13.5 * PLAYER_SCALE,
    reachRadius: 1.95 * PLAYER_SCALE,
    accuracy: 0.94,
    power: 0.62,
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
