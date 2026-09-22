export type AccessPoint={x:number;y:number;z:number};
export type AccessSite={id:string;buildingId:string;name:string;building:any;center:{x:number;z:number;clearance:number};half:number;ground:number;roofY:number;entrance:AccessPoint&{nx:number;nz:number;ux:number;uz:number;doorX:number;doorZ:number};lobby:number[][];room:number[][];kind:string;stairs:boolean;travel:string;interiorY:number;roof:AccessPoint;lobbyPoint:AccessPoint;equipment:AccessPoint;restroom:AccessPoint|null;source:string};
export const SKY_TOWER_ID:string;
export const CAFE_REVOLUTION_SECONDS:number;
export function buildingAccessSites(world?:any):AccessSite[];
export function siteVolumes(site:AccessSite):{p:number[][];minY:number;h:number}[];
export function stairTreads(site:AccessSite):{id:string;x:number;z:number;y:number;w:number;d:number;h:number;landing:boolean}[];
export function accessCollisionSolids(solids:any[],sites?:AccessSite[]):any[];
