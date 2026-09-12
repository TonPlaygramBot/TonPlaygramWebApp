import type {Car,State,Point} from './engine.mjs';
export function vehicleSize(car:Car):{length:number;width:number};
export function populateTraffic(state:State,spawn:Point):void;
export function updateTraffic(state:State,dt:number,onImpact:Function):void;
export function vehicleSeparation(a:Car,b:Car):{x:number;z:number}|null;
