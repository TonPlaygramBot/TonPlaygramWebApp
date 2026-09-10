import type { Racer, Track } from './simulation.mjs';
import type { Weapon } from './suppliedWeaponCatalog.mjs';
export interface Pickup {
  id: number;
  weaponId: string;
  x: number;
  z: number;
  yaw: number;
  cooldown: number;
  special: boolean;
}
export interface Projectile {
  id: number;
  weaponId: string;
  ownerId: string;
  targetId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}
export interface CombatSnapshot {
  pickups: Pickup[];
  shots: Projectile[];
  explosions: { id: number; x: number; y: number; z: number; life: number }[];
}
export interface CombatState extends CombatSnapshot {
  nextShot: number;
}
export const MAX_PROJECTILES: number;
export function validWeaponId(id: unknown): string;
export function selectedWeapon(r: Racer): (Weapon & { ammo: number }) | null;
export function syncWeapon(r: Racer): void;
export function equipCombat(r: Racer, ammo: number): void;
export function collectWeapon(r: Racer, id: string): boolean;
export function pointOnRace(
  track: Track,
  t: number,
  lane?: number
): { x: number; z: number; yaw: number };
export function createCombatState(track: Track): CombatState;
export function raceCombat(racers: Racer[], track: Track): CombatState;
export function combatSnapshot(racers: Racer[], track: Track): CombatSnapshot;
export function projectileStyle(id: string): {
  color: number;
  size: number;
  life: number;
  homing: number;
};
export function nearestWeaponTarget(
  owner: Racer,
  racers: Racer[],
  range?: number
): Racer | null;
export function fireRaceWeapon(
  state: CombatState,
  owner: Racer,
  racers: Racer[]
): boolean;
export function shotContact(
  a: { x: number; z: number },
  b: { x: number; z: number },
  r: Racer,
  before?: { x: number; z: number }
): number | null;
export function applyWeaponHit(target: Racer, weapon: Weapon): void;
export function startCombatRepair(target: Racer): void;
export function stepCombat(
  state: CombatState,
  racers: Racer[],
  track: Track,
  dt: number,
  time: number,
  nearestPoint: (t: Track, x: number, z: number) => { distance: number },
  previous?: Map<string, { x: number; z: number }>
): void;
