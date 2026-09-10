import type {ReferenceProfile} from './profiles.mjs';
import type {LandmarkBuilding} from './landmarkData.mjs';
export type LandmarkSite=Omit<ReferenceProfile,'floor'|'window'|'photo'|'credit'> & {photo?:string;credit?:string;photoSource?:string};
export const LANDMARK_CATALOG:Record<string,LandmarkSite>;
export const LANDMARK_PROFILES:Record<string,ReferenceProfile>;
export const LANDMARK_REPLACED_IDS:Set<string>;
export function landmarkBuildings<T extends {id:string;p:number[][];h:number}>(world:{buildings:T[]}):(T & Partial<LandmarkBuilding>)[];
