export const KART_ASSETS: typeof MILITARY_ASSETS;
export const MILITARY_ASSETS: Readonly<
  Record<
    string,
    { file: string; eye: [number, number, number]; wheelRadius: number }
  >
>;
export interface VehicleFit {
  scale: number;
  offset: number[];
}
export function vehicleAssetUrl(id: string, low?: boolean): string;
export function normaliseVehicleDimensions(
  bounds: { min: number[]; max: number[] },
  targetLength?: number
): VehicleFit;
export function vehicleDriverMount(id: string, fit: VehicleFit): number[];

export const VEHICLE_LENGTHS: Readonly<Record<string, number>>;
export type CockpitStyle = 'kart' | 'armored' | 'suv' | 'sport' | 'sedan';
export function cockpitStyle(id: string): CockpitStyle;
export const COCKPIT_URL: string;
