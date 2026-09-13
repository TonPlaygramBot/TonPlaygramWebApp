import type {Track,Racer} from './simulation.mjs';
export interface JumpRamp {id:number;x:number;z:number;yaw:number;distance:number;index:number;width:number;length:number;height:number;}
export function jumpRamps(track:Track):JumpRamp[];
export function resetJump(r:Racer,track:Track):void;
export function stepJumps(r:Racer,track:Track,dt:number,time:number,previousX:number,previousZ:number):void;
