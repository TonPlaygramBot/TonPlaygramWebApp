import type {State,Point,Player,Pickup,Shop} from './engine.mjs';
export const CITY_POPULATION:Readonly<{vehicles:number;buses:number;weapons:number;shops:number;pedestrians:number}>;
export function nearestShop(state:State,p:Point):Shop;
export function citySites(env:any):{shops:Shop[];pickups:Pickup[]};
export function initCityPopulation(state:State,env:any):void;
export function collectWeapon(state:State,p:Player,id:string):boolean;
export function dropWeapon(state:State,n:any):void;
export function shopObstacles():Array<{id:string;h:number;minY:number;minX:number;maxX:number;minZ:number;maxZ:number;p:number[][]}>;
export function shopObstaclesNear(x:number,z:number):ReturnType<typeof shopObstacles>;
