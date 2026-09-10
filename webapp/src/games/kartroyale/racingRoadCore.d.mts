import type { Track } from './simulation.mjs';
export const RACE_ROAD_WIDTH: number, TIRE_RADIUS: number, CURB_WIDTH: number;
export function roadCorners(track: Track): number[][];
export function roadFootprint(track: Track, extra?: number): number[][][][];
export function roadCurbFootprint(track: Track): number[][][][];
export function raceCityBuildings<T extends { p: number[][] }>(
  track: Track,
  buildings: T[]
): T[];
export function centerlineDistance(track: Track, x: number, z: number): number;
export function racingTireLayout(
  track: Track
): {
  x: number;
  z: number;
  yaw: number;
  row: number;
  seed: number;
  distance: number;
  spacing: number;
  perimeter: number;
}[];
