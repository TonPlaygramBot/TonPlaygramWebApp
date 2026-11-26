export type BuildingProfile = { name: string; color: number; trim: number; floor: number; window: number; height?: number; style: string; source: string };
export const BUILDING_PROFILES: Readonly<Record<string, BuildingProfile>>;
export function buildingProfile(b: { id: string; p: number[][]; h: number; name: string }): BuildingProfile;
export function polygonContains(x: number, z: number, polygon: number[][], holes?: number[][][]): boolean;
export function footprintDistance(x: number, z: number, polygon: number[][], holes?: number[][][]): number;
