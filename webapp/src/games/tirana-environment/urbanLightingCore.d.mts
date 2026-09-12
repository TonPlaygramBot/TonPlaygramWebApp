import type {Road} from './roadSurfaceCore.mjs';
type Building={p:number[][];h:number;minHeight?:number;tags?:Record<string,string>};
export function streetLampPlacements(world:{buildings?:Building[];roads?:Road[]}):{x:number;z:number;yaw:number;height:number;road:string}[];
export function largeBuildingAprons(world:{buildings?:Building[]},pad?:number):number[][][];
export function urbanLightLevel(environment:{night?:number;daylight?:number;hour?:number},kind?:string):number;
