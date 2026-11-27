type V3=[number,number,number];
type Quad=[V3,V3,V3,V3];
export const MARKET_ID:string;
export const NINE_STOREY_IDS:readonly string[];
export const MARKET_GLAZING:number;
export function marketExterior(ring:number[][]):null|{
 roof:Quad[];
 beams:[V3,V3,number][];
 boxes:[number,V3,V3,number][];
 floor:[number,Quad][];
};
export function nineStoreyBays(edgeLength:number,height:number,ordinal:number):{
 u:number;n:number;y:number;story:number;width:number;balcony:boolean;awning:boolean;
}[];
