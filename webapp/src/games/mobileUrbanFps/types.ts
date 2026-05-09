import type { Vector3 } from 'three';

export type GamePhase = 'playing' | 'won' | 'lost';
export type VehicleMode = 'onFoot' | 'helicopter';
export type EnemyAiState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';

export type TouchInputState = {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  firing: boolean;
  reloading: boolean;
};

export type WeaponStats = {
  magazineSize: number;
  reserveAmmo: number;
  fireRateMs: number;
  reloadMs: number;
  damage: number;
  spread: number;
  recoilKick: number;
  recoilRecovery: number;
  falloffStart: number;
  falloffEnd: number;
};

export type EnemyRuntime = {
  id: string;
  position: Vector3;
  patrolTarget: Vector3;
  health: number;
  maxHealth: number;
  state: EnemyAiState;
  attackCooldown: number;
  hitFlash: number;
};

export type ImpactFx = {
  id: number;
  position: [number, number, number];
  normal: [number, number, number];
  life: number;
};

export type BulletTracer = {
  id: number;
  from: [number, number, number];
  to: [number, number, number];
  life: number;
};
