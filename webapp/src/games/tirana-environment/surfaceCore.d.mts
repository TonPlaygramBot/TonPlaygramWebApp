export function pavingProfile(tags?:{surface?:string}):{kind:string;source:string;verifiedMaterial:boolean};
export function insideRing(point:number[],ring:number[][]):boolean;
export function polygonHas(point:number[],polygon:number[][][]):boolean;
export function seededParkPoints(polygons:number[][][][],options?:{spacing?:number;limit?:number;excluded?:(x:number,z:number)=>boolean}):{x:number;z:number;scale:number}[];
export function roadCorridor(road:{a:number[];b:number[];w:number},pad?:number):number[][]|null;
export const PAVING_REFERENCES:readonly {id:string;kind:string;source:string;status:string}[];
