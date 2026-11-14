import type {Aircraft,Point} from '../shared/engine.mjs';
export function angleDifference(a:number,b:number):number;
export function pilotView(aircraft:Aircraft,yaw:number,pitch:number,aspect?:number):{eye:Point&{y:number};direction:Point&{y:number};up:Point&{y:number};fov:number};
export function flightReadout(aircraft:Aircraft,terrainY?:number):{heading:number;cardinal:string;altitude:number;speed:number;climb:number};
