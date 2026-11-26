export type CollectionVehicle = Readonly<{
  id: string; name: string; url: string; sha256: string; bytes: number;
  length: number; width: number; height: number;
  driverSeat: readonly [number, number, number];
}>;
export const VEHICLE_COLLECTION: readonly CollectionVehicle[];
export const COLLECTION_BY_ID: ReadonlyMap<string, CollectionVehicle>;
export const COLLECTION_DRIVER_URL: string;
export const CIVILIAN_VEHICLE_MODELS: Readonly<Record<string, string>>;
export function collectionVehicleFor(car: {collectionVehicle?: string}): CollectionVehicle | undefined;
export function roadVehicleFor(car: {collectionVehicle?: string; model?: string; forceVehicle?: string}): CollectionVehicle | undefined;
