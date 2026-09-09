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
export type WeaponId = 'ar' | 'smg';
export type Difficulty = 'recruit' | 'veteran';
export type Settings = {
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
