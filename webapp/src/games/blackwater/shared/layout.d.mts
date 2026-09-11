import type { BattlefieldMapId, Obstacle, Vec2 } from '../core';
export type Road = {
  id: number;
  a: number[];
  b: number[];
  w: number;
  walk: boolean;
  name: string;
  bridge: boolean;
};
export type Building = Obstacle & {
  id: string;
  rot: number;
  template: number;
  footprint: number[][];
  holes?: number[][][];
};
export type Prop = Obstacle & { forceVehicle?: string; sx: number; sz: number; rot: number };
export const ORIGIN: Readonly<Vec2>;
export const MAP: Readonly<{
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}>;
export const ATTRIBUTION: string;
export const SOURCE_SHA256: string;
export const roads: Road[];
export const buildings: Building[];
export const props: Prop[];
export const landmarkObstacles: (Obstacle & {landmarkId:string})[];
export const streetObstacles: Obstacle[];
export const railingObstacles: Obstacle[];
export const OBSTACLES: readonly Obstacle[];
export const START: Readonly<Vec2>;
export const EXTRACTION: Readonly<Vec2>;
export const SPAWNS: readonly Readonly<Vec2>[];
export const BATTLEFIELD_MAPS: readonly Readonly<{id:BattlefieldMapId;name:string;start:Readonly<Vec2>;extraction:Readonly<Vec2>}>[];
export function nearestRoad(
  x: number,
  z: number
): Vec2 & { road: Road; distance: number };
