import * as THREE from 'three';

export type Side = 'player' | 'ai';
export type ShotType = 'forehand drive' | 'backhand drive' | 'push' | 'brush/topspin' | 'lob';

export interface DifficultyConfig {
  reactionTime: number;
  moveSpeed: number;
  accuracy: number;
  shotPower: number;
  mistakeChance: number;
}

export const GAME_CONFIG = {
  fixedDt: 1 / 120,
  gravity: -9.8,
  drag: 0.09,
  spinCurve: 0.08,
  ballRadius: 0.055,
  serveHeight: 0.34,
  table: {
    width: 1.8,
    length: 3.08,
    topY: 0.76,
    thickness: 0.08,
    color: '#1266c3',
    lineColor: '#e8f4ff',
  },
  net: {
    height: 0.18,
    thickness: 0.028,
    overhang: 0.1,
  },
  player: {
    z: 2.38,
    minX: -1.02,
    maxX: 1.02,
    safeZ: 2.22,
    moveSpeed: 2.55,
    reach: 0.52,
    recoveryTime: 0.28,
    avatarScale: 1.42,
  },
  ai: {
    z: -2.38,
    minX: -1.02,
    maxX: 1.02,
    maxReach: 0.66,
    avatarScale: 1.42,
    difficulty: {
      reactionTime: 0.24,
      moveSpeed: 2.05,
      accuracy: 0.78,
      shotPower: 1,
      mistakeChance: 0.14,
    } satisfies DifficultyConfig,
  },
  paddle: {
    hitRadius: 0.21,
    timingWindow: 0.12,
    minFacingDot: 0.22,
    drivePower: 3.75,
    pushPower: 2.85,
    lobPower: 2.95,
    spin: 3.6,
    accuracy: 0.9,
  },
  camera: {
    position: new THREE.Vector3(0, 2.2, 4.7),
    target: new THREE.Vector3(0, 0.94, 0.15),
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
