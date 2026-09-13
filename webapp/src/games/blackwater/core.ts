export type Vec2 = { x: number; z: number };
export type Obstacle = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  minY?: number;
  rot?: number;
  footprint?: number[][];
};
export type Phase = 'menu' | 'playing' | 'paused' | 'upgrade' | 'won' | 'lost';
export type WeaponId = 'ar' | 'smg' | 'ak47' | 'shotgun' | 'mosin' | 'uzi' | 'sigsauer' | 'smith' | 'acr' | 'dragunov' | 'vityaz' | 'ar15' | 'makarov';
export type BattlefieldMapId = 'skanderbeg' | 'blloku' | 'lana' | 'pyramid' | 'bazaar' | 'stadium' | 'station' | 'park' | 'embassy' | 'dajti-gate' | `district-${string}`;
export type Difficulty = 'recruit' | 'veteran';
export type Settings = {
  targetFps: import('../tiranastreets/renderSettings').TargetFps;
  sensitivity: number;
  volume: number;
  assist: boolean;
  quality: 'auto' | 'high' | 'low';
};
export {
  WEAPONS,
  MAP,
  EXTRACTION,
  clamp,
  collides,
  moveCircle,
  rayBox,
  lineClear,
  findPath,
  waveCount,
  afterWave,
  reloadAmmo,
  createRng
} from './shared/physics.mjs';
