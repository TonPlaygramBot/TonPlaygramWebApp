type Base={m:string;p:[number,number,number];r:[number,number,number]};
export type Part=Base&({kind:'box';s:[number,number,number]}|{kind:'cylinder';radius:number;top:number;height:number;segments:number});
export const PALETTE:Readonly<Record<string,{color:number;roughness:number;metalness:number}>>;
export const RECIPES:Readonly<Record<string,{category:string;parts:Part[]}>>;
export const ASSET_IDS:readonly string[];
