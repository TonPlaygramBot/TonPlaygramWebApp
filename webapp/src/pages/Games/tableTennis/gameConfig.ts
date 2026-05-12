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
export type PointReason = "out" | "doubleBounce" | "net" | "wrongSide" | "miss";

export const TT = {
  table: {
    length: 5.8,
    width: 3.2,
    y: 1.45,
    topThickness: 0.075,
    netHeight: 0.1525,
    netPostOutside: 0.1525,
    netDepth: 0.016,
  },
  ball: {
    radius: 0.038,
    gravity: 9.81,
    airDrag: 0.22,
    magnus: 0.00125,
    tableRestitution: 0.9,
    tableFriction: 0.965,
    spinDecay: 0.72,
    fixedStep: 1 / 120,
  },
  player: {
    speed: 3.35,
    safeXRatio: 0.82,
    nearZMinExtra: 0.18,
    nearZMaxExtra: 0.9,
    recoveryTime: 0.2,
  },
  paddle: {
    hitRadius: 0.33,
    angleDotMin: 0.1,
    contactWindowSeconds: 0.13,
    minIncomingSpeed: 0.25,
    accuracy: 0.86,
    power: 1,
    spin: 1,
  },
  ai: {
    reactionTime: 0.22,
    moveSpeed: 3.15,
    accuracy: 0.82,
    shotPower: 0.82,
    mistakeChance: 0.13,
    maxReach: 0.72,
  },
  camera: {
    portraitFov: 48,
    landscapeFov: 42,
    damping: 5.5,
  },
} as const;

export const TABLE_HALF_W = TT.table.width / 2;
export const TABLE_HALF_L = TT.table.length / 2;
export const BALL_SURFACE_Y = TT.table.y + TT.ball.radius;
export const UP = new THREE.Vector3(0, 1, 0);

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");
export const opposite = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
export const isOverVisibleTable = (x: number, z: number, margin = 0) => Math.abs(x) <= TABLE_HALF_W + margin && Math.abs(z) <= TABLE_HALF_L + margin;
export const netBounds = () => ({
  minX: -TABLE_HALF_W - TT.table.netPostOutside,
  maxX: TABLE_HALF_W + TT.table.netPostOutside,
  minY: TT.table.y,
  maxY: TT.table.y + TT.table.netHeight,
  minZ: -TT.table.netDepth / 2,
  maxZ: TT.table.netDepth / 2,
});
