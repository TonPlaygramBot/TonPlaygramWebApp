export type FacadeSite={id:string;x:number;z:number;yaw:number;width:number;height:number;distance:number;variant:number};
export const AD_BRANDS:readonly {id:string;title:string;line:string;accent:string;background:string;product:string}[];
export function stableHash(s:unknown):number;
export function distanceToSegment(p:{x:number;z:number},a:readonly number[],b:readonly number[]):number;
export function facadeSites(world:any,excluded?:Set<string>):FacadeSite[];
export function createSiteIndex(sites:FacadeSite[],cellSize?:number):(viewer:{x:number;z:number},radius?:number,limit?:number)=>FacadeSite[];
