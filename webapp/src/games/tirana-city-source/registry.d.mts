import type {CitySite,MappedTree} from './sourceCore.mjs';
export const CITY_PLACES:{sites:CitySite[];issues:{id:string;reason:string}[]};
export const INSTITUTION_BUILDING_IDS:Set<string>;
export const MAPPED_CYCLING:{segments:any[];issues:{id:string;reason:string}[]};
export const MAPPED_TREES:MappedTree[];
export const BUILDING_SOURCE_TAGS:Map<string,Record<string,string>>;
export const BUILDING_SITE:Map<string,CitySite>;
