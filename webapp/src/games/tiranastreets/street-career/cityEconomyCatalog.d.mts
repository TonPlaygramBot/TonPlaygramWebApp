import type {AccessSite,AccessPoint} from '../shared/buildingAccess.mjs';
export type EconomySite=Omit<AccessSite,'kind'> & {id:string;accessId:string;kind:'bank'|'apartment'|'house'|'villa';price?:number;stashMagazines?:number;reward?:number;x:number;z:number;counter:AccessPoint};
export const ECONOMY_PROPERTIES:readonly {id:string;buildingId:string;name:string;kind:string;price:number;stashMagazines:number}[];
export const ECONOMY_BANKS:readonly {id:string;buildingId:string;name:string;kind:string;reward:number}[];
export function cityEconomySites(world?:any):EconomySite[];
