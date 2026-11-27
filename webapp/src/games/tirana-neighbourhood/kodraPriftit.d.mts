export const KODRA_PRIFTIT_VIEW:Readonly<{x:number;z:number;radius:number;bounds:number[]}>;
export const KODRA_ASPHALT:16;
export const KODRA_COMPACTED:17;
export function kodraRoadFinish(road:{way?:string;name?:string;bridge?:boolean;tunnel?:boolean;tags?:Record<string,string|undefined>}|null|undefined):0|16|17;
export function kodraPlasterWall(building:{p?:number[][];h?:number;special?:string;tags?:Record<string,string|undefined>}|null|undefined):boolean;
