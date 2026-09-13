import type { Track } from './simulation.mjs';
export type TyrePosition = { x:number; z:number; index:number };
export function trackSurfaceTriangles(track: Track): number[][][];
export function trackSurface(track: Track): { polygons:number[][][][]; triangles:number[][][]; clearance(x:number,z:number,limit?:number):number };
export function tyreBarrierLayout(track: Track, buildingClearance?:(x:number,z:number)=>number): { positions:TyrePosition[]; rejectedRoad:number; rejectedBuilding:number; rejectedOverlap:number };
