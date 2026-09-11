import type { MILITARY_VEHICLES } from './militaryVehicleCatalog.mjs';
export const ALBANIAN_FORCES_VEHICLES: typeof MILITARY_VEHICLES;
export const ALBANIAN_FORCES_CHARACTERS: readonly string[];
export const ALBANIAN_FORCES_ASSETS: Readonly<
  Record<string, { eye: [number, number, number]; wheelRadius: number }>
>;
export function isAlbanianForcesVehicle(id: string): boolean;
export function albanianForcesAssetUrl(id: string, low?: boolean): string;
