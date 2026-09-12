export type Road = {a:number[];b:number[];w:number;walk?:boolean;bridge?:boolean;tunnel?:boolean;[key:string]:any};
export type Polygon = number[][][];
export function roadRing(road:Road,width?:number,extension?:number):number[][]|null;
export function roadSurfaceIndex(roads:Road[],size?:number):(polygon:Polygon)=>Polygon[];
export function bounds(ring:number[][]):number[];
export function splitRoadCells(roads:Road[],size?:number):Map<string,{key:string;x:number;z:number;roads:Road[];bounds:number[]}>;

export function clipRingToBounds(ring:number[][],box:number[]):number[][];
