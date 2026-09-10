export type StreetPart={shape:string;color:number;p:number[];s:number[];pitch?:number};
export type StreetSign={text:string;p:number[];s:number[];bg:string;fg:string;yaw:number;atlas?:number};
export type StreetModel={id:string;x:number;z:number;yaw:number;type:string;parts:StreetPart[];signs:StreetSign[]};
export function buildStreetModel(site:unknown,type:string):StreetModel;
export function nearbyIndex<T extends {x:number;z:number}>(items:T[],cellSize?:number):(viewer:{x:number;z:number},radius:number,limit:number)=>T[];
