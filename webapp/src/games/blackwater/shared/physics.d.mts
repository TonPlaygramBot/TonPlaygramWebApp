import type { Obstacle, Vec2, WeaponId } from '../core';
type Vec3 = Vec2 & { y: number };
export { MAP, EXTRACTION } from './layout.mjs';
export const WEAPONS: Readonly<
  Record<
    WeaponId,
    {
      name: string;
      role: string;
      mag: number;
      damage: number;
      interval: number;
      reload: number;
      spread: number;
      recoil: number;
    }
  >
>;
export function clamp(v: number, min: number, max: number): number;
export function collides(
  x: number,
  z: number,
  r: number,
  obstacles: readonly Obstacle[]
): boolean;
export function moveCircle(
  p: Vec2,
  dx: number,
  dz: number,
  r: number,
  obstacles: readonly Obstacle[]
): void;
export function rayBox(origin: Vec3, dir: Vec3, o: Obstacle): number;
export function lineClear(
  a: Vec3,
  b: Vec3,
  obstacles: readonly Obstacle[]
): boolean;
export function findPath(
  start: Vec2,
  goal: Vec2,
  obstacles: readonly Obstacle[]
): Vec2[];
export function waveCount(wave: number): number;
export function afterWave(wave: number): 'upgrade' | 'extract';
export function reloadAmmo(
  ammo: number,
  reserve: number,
  capacity: number
): { ammo: number; reserve: number };
export function createRng(seed: number): () => number;
