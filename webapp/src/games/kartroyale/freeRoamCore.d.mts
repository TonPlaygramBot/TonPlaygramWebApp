import type {Racer} from './simulation.mjs';
export interface RoamRoad {a:number[];b:number[];w:number;walk?:boolean;name?:string;highway?:string;}
export interface DrivingWorld {
  mode:'free-roam';bounds:number[];
  nearestRoad(x:number,z:number,radius?:number):{x:number;z:number;yaw:number;width:number;distance:number;name:string}|null;
  nearbyRoads(x:number,z:number,radius?:number):RoamRoad[];
  recover(r:Racer):void;
  move(r:Racer,x:number,z:number,dt:number):unknown;
}
export function createDrivingWorld(world:{roads:RoamRoad[];buildings:{p:number[][]}[];bounds:number[];waterAreas?:{polygons:{outer:number[][];holes?:number[][][]}[]}[]}):DrivingWorld;
