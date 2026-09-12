export function housingSeed(id:string):number;
export function housingEra(building:any,tags?:Record<string,string>):null|{era:string;confidence:string;year:number|null;basis:string};
export function insideRoof(x:number,z:number,polygon:number[][],holes?:number[][][]):boolean;
export function roofClearance(x:number,z:number,polygon:number[][],holes?:number[][][]):number;
export function rooftopTanks(b:any):{x:number;z:number;y:number;radius:number;height:number;black:boolean}[];
