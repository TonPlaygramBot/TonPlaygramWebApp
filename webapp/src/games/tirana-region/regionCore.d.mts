export type RegionReference={id:string;name:string;latitude:number;longitude:number;source:string;osm?:string;accuracy:string};
export const REGION_REFERENCES:readonly RegionReference[];
export const REGION_BBOX:readonly number[];export const REGION_STATUS:string;
export function projectRegion(origin:readonly number[],latitude:number,longitude:number):{x:number;z:number};
export function regionalReferences(origin:readonly number[]):(RegionReference&{x:number;z:number;available:false})[];
export function regionalBounds(origin:readonly number[],cityBounds:readonly number[]):readonly number[];
export function referenceLinks(p:RegionReference):Record<'satellite'|'streetView'|'earth'|'osm',string>;
export function buildRegionQuery(bbox?:readonly number[]):string;
export function sampleHeight(grid:{width:number;height:number;bounds:readonly number[];values:readonly (number|null)[];noData?:number},x:number,z:number):number|null;
