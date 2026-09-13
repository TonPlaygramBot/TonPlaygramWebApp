import type { Racer, Track } from './simulation.mjs';
export interface RoadBump { x:number; z:number; yaw:number; index:number; distance:number; id:number; width:number; length:number; height:number }
export const ROAD_SURFACE_Y:number, TYRE_RADIUS:number, TYRE_EDGE_OFFSET:number;
export function roadBumps(track:Track):RoadBump[];
export function roadHeight(bumps:RoadBump[],x:number,z:number):number;
export function resetSuspension(r:Racer):void;
export function stepSuspension(r:Racer,track:Track,dt:number):void;
