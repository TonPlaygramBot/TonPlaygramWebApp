export interface VegetationSite {
  x: number;
  z: number;
  scale: number;
  variant: number;
}
export const VEGETATION_BUDGETS: {
  trees: number;
  shrubs: number;
  grass: number;
  flowers: number;
};
export function footprintFits(
  polygon: number[][][],
  x: number,
  z: number,
  radius: number
): boolean;
export function racingVegetationSites(
  parks: number[][][][],
  track: { points: readonly any[]; width: number }
): Record<'trees' | 'shrubs' | 'grass' | 'flowers', VegetationSite[]>;
