import type {Racer} from './simulation.mjs';
export interface RoamRoad {a:number[];b:number[];w:number;walk?:boolean;name?:string;highway?:string;bridge?:boolean;tunnel?:boolean;}
export interface DrivingWorld {
  mode:'free-roam';bounds:number[];
  nearestRoad(x:number,z:number,radius?:number):{x:number;z:number;yaw:number;width:number;distance:number;name:string}|null;
  nearbyRoads(x:number,z:number,radius?:number):RoamRoad[];
  recover(r:Racer):void;
  move(r:Racer,x:number,z:number,dt:number):unknown;
}
export interface RoamObstacle {x?:number;z?:number;a?:number[];b?:number[];outer?:number[][];holes?:number[][][];radius?:number;height?:number;material:string;}
export interface DrivingWorldData {roads:RoamRoad[];buildings:{p:number[][];holes?:number[][][];minHeight?:number;h?:number}[];bounds:number[];waterAreas?:{polygons:{outer:number[][];holes?:number[][][]}[]}[];waterPolygons?:{outer:number[][];holes?:number[][][]}[];trees?:{x:number;z:number;radius?:number;height?:number;h?:number}[];obstacles?:RoamObstacle[];}
export function createDrivingWorld(world:DrivingWorldData):DrivingWorld;
