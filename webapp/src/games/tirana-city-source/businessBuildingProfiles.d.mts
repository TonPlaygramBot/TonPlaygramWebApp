import type {ReferenceProfile} from './profiles.mjs';
export const BUSINESS_BUILDING_PROFILES:Readonly<Record<string,ReferenceProfile & {referenceImage:string}>>;
export const BUSINESS_OBSERVED_HEIGHTS:Readonly<Record<string,{height:number;basis:string;source:string}>>;
export const BUSINESS_BUILDING_PARTS:{id:string;parentBuildingId:string;name:string;h:number;p:number[][];heightBasis:string;visualHeightSource:string}[];
