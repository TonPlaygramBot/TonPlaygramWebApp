export const MILITARY_ASSETS: Readonly<
  Record<
    string,
    { file: string; eye: [number, number, number]; wheelRadius: number; targetLength: number }
  >
>;
export interface VehicleFit {
  scale: number;
  offset: number[];
}
export const FERRARI_ASSET_URL: string;
export function vehicleAssetUrl(id: string, low?: boolean): string;
export function vehicleTargetLength(id: string): number;
export function normaliseVehicleDimensions(
  bounds: { min: number[]; max: number[] },
  targetLength?: number
): VehicleFit;
export function vehicleDriverMount(id: string, fit: VehicleFit): number[];
