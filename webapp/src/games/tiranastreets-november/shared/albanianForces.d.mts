export type ForceAsset = Readonly<{
  id: string; label: string; category: 'vehicle' | 'person';
  wheelRadius: number; url: string;
}>;
export const FORCE_ASSETS: readonly ForceAsset[];
export const FORCE_ASSET_BY_ID: ReadonlyMap<string, ForceAsset>;
export function forceDispatch(stars: number, slot?: number): {forceVehicle: string; forceCharacter: string};
export function forceVehicleFor(car: {model: string; forceVehicle?: string}): ForceAsset | undefined;
export function forceCharacterFor(npc: {kind: string; forceCharacter?: string}): ForceAsset | undefined;

export const FORCE_VEHICLE_BOUNDS: readonly Readonly<{id: string; w: number; d: number; h: number}>[];
