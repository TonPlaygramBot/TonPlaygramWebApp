export function inside(x:number,z:number,p:number[][],holes?:number[][][]):boolean;
export function nearestPoint(p:number[],a:number[],b:number[]):number[];
export function distance(p:number[],a:number[],b:number[]):number;
export function spatialIndex(items:any[],bounds:(item:any)=>number[],size?:number):(x:number,z:number,pad?:number)=>any[];
export function bounds(p:number[][]):number[];
export function hash(id:string):number;
export function parkingBays(feature:any,blocked?:(x:number,z:number)=>boolean):any[];
