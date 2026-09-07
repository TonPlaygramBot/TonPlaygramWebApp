import { WORLD } from './world.mjs';
export const RACING_REGION: {
  roads: typeof WORLD.roads;
  buildings: typeof WORLD.buildings;
  bounds: number[];
  source: string;
  sourceSha256: string;
  origin: number[];
  attribution: string;
  osmTimestamp: string;
};
