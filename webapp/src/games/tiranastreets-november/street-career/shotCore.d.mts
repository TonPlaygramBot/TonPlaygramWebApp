import type { Car, NPC } from '../shared/engine.mjs';
import type { StreetWorld, Vec3 } from './spatialCore.mjs';
export function traceShot(world: StreetWorld, from: Vec3, direction: Vec3, range: number, cars: Car[], actors: NPC[]): {
  hit: ReturnType<StreetWorld['cast']>;
  target: NPC | null;
};
export function hitMultiplier(actor: NPC, point: Vec3): number;
