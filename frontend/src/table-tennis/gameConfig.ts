import * as THREE from 'three';

export type Side = 'player' | 'ai';
export type ShotType = 'forehand drive' | 'backhand drive' | 'push' | 'brush/topspin' | 'lob' | 'swerve power';

export interface ShotCommand {
  /** -1 aims to the left sideline, +1 aims to the right sideline from the striker's screen perspective. */
  aimX: number;
  /** 0 is a soft touch, 1 is the strongest drive. */
  power: number;
  /** 0 is a flat/low shot, 1 is a higher clearance arc. */
  lift: number;
  /** -1 bends left, +1 bends right with side spin. */
  curve: number;
  /** -1 slices/backspins, +1 brushes heavy topspin. */
  spin: number;
}

export interface DifficultyConfig {
  reactionTime: number;
  moveSpeed: number;
  accuracy: number;
  shotPower: number;
  mistakeChance: number;
}

// Pool Royale exports its current 7ft outer table footprint as 61.651044 × 90.4215312
// world units. Table Tennis uses the same width:length ratio and scaled-down footprint so
// it occupies the same HDRI placement/orientation while staying in this game's meter-sized scene.
const POOL_ROYALE_TABLE_WIDTH = 61.651044;
const POOL_ROYALE_TABLE_LENGTH = 90.4215312;
const POOL_ROYALE_TO_TABLE_TENNIS_SCALE = 0.045;
const TABLE_WIDTH = POOL_ROYALE_TABLE_WIDTH * POOL_ROYALE_TO_TABLE_TENNIS_SCALE;
const TABLE_LENGTH = POOL_ROYALE_TABLE_LENGTH * POOL_ROYALE_TO_TABLE_TENNIS_SCALE;
const TABLE_LENGTH_SCALE = TABLE_LENGTH / 2.74;
const TABLE_WIDTH_SCALE = TABLE_WIDTH / 1.55;

export const GAME_CONFIG = {
  fixedDt: 1 / 120,
  gravity: -9.8,
  drag: 0.09,
  spinCurve: 0.08,
  ballRadius: 0.062,
  serveHeight: 0.38,
  serveForwardPower: 2.9 * TABLE_LENGTH_SCALE,
  table: {
    width: TABLE_WIDTH,
    length: TABLE_LENGTH,
    topY: 0.76,
    thickness: 0.09,
    color: '#1266c3',
    lineColor: '#e8f4ff',
  },
  net: {
    height: 0.2,
    thickness: 0.03,
    overhang: 0.13,
  },
  player: {
    z: TABLE_LENGTH / 2 + 0.84,
    minX: -TABLE_WIDTH / 2 - 0.12,
    maxX: TABLE_WIDTH / 2 + 0.12,
    safeZ: TABLE_LENGTH / 2 + 0.68,
    moveSpeed: 2.55 * TABLE_WIDTH_SCALE,
    reach: 0.48 * TABLE_WIDTH_SCALE,
    autoTrackLead: 0.34 * TABLE_WIDTH_SCALE,
    recoveryTime: 0.28,
    avatarScale: 1.62,
  },
  ai: {
    z: -TABLE_LENGTH / 2 - 0.84,
    minX: -TABLE_WIDTH / 2 - 0.12,
    maxX: TABLE_WIDTH / 2 + 0.12,
    maxReach: 0.58 * TABLE_WIDTH_SCALE,
    avatarScale: 1.62,
    difficulty: {
      reactionTime: 0.24,
      moveSpeed: 2.05 * TABLE_WIDTH_SCALE,
      accuracy: 0.78,
      shotPower: 1.0,
      mistakeChance: 0.14,
    } satisfies DifficultyConfig,
  },
  paddle: {
    hitRadius: 0.18 * TABLE_WIDTH_SCALE,
    timingWindow: 0.12,
    minFacingDot: 0.22,
    drivePower: 3.35 * TABLE_LENGTH_SCALE,
    pushPower: 2.55 * TABLE_LENGTH_SCALE,
    lobPower: 2.65 * TABLE_LENGTH_SCALE,
    powerShotMultiplier: 1.18,
    spin: 3.6,
    sideSpin: 4.2,
    accuracy: 0.9,
  },
  camera: {
    position: new THREE.Vector3(0, 2.7, 6.1),
    target: new THREE.Vector3(0, 1.02, 0.18),
    damping: 8,
  },
  score: {
    gamePoint: 11,
    winBy: 2,
  },
} as const;

export const TABLE_BOUNDS = {
  minX: -GAME_CONFIG.table.width / 2,
  maxX: GAME_CONFIG.table.width / 2,
  minZ: -GAME_CONFIG.table.length / 2,
  maxZ: GAME_CONFIG.table.length / 2,
};

export const NET_BOUNDS = {
  minX: -GAME_CONFIG.table.width / 2 - GAME_CONFIG.net.overhang,
  maxX: GAME_CONFIG.table.width / 2 + GAME_CONFIG.net.overhang,
  minY: GAME_CONFIG.table.topY,
  maxY: GAME_CONFIG.table.topY + GAME_CONFIG.net.height,
  minZ: -GAME_CONFIG.net.thickness / 2,
  maxZ: GAME_CONFIG.net.thickness / 2,
};
