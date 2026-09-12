export type MappedAmenity={id:string;name:string;category:string;x:number;z:number;ring:number[][]|null;tags:Record<string,string>;source:string;accuracy:string;furnishingAnchor?:{x:number;z:number}};
export function amenityAnchor(site:MappedAmenity,clearance?:number):{x:number;z:number}|null;
export const MAPPED_PARKS:MappedAmenity[];
export const LOCAL_FUEL:(MappedAmenity & {yaw:number;kind:string;width:number;signHeight:number;mountHeight:number})[];
