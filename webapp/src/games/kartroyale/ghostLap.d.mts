import type {Racer,Track} from './simulation.mjs';
export interface GhostLap {version:number;time:number;sectors:number[];samples:number[][];}
export const GHOST_VERSION:number;
export function ghostKey(track:Track,kart:string):string;
export function loadGhost(storage:Storage|undefined,key:string):GhostLap|null;
export function sampleGhost(ghost:GhostLap|null,time:number):{x:number;z:number;yaw:number;y:number}|null;
export class GhostRecorder {
 constructor(storage:Storage|undefined,key:string,sessionBest?:{ghost:GhostLap;saved:boolean});
 key:string;
 best:GhostLap|null;reference:GhostLap|null;saved:boolean;improved:boolean;
 update(r:Racer,time:number):void;
 split(r:Racer):number|null;
}
