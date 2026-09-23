import type {Track,Racer} from './simulation.mjs';
export interface CityJob {id:string;title:string;district:string;track:string;kind:'delivery'|'patrol'|'drift'|'precision';unlock:number;xp:number;seconds:number;health:number;score?:number;stops:readonly number[];labels:readonly string[];brief:string}
export interface CityCareer {version:1;medals:Record<string,number>;best:Record<string,number>}
export interface CityJobState {id:string;status:'active'|'complete'|'failed';elapsed:number;stage:number;hold:number;score:number;chain:number;impacts:number;lastImpact:number;medal:number;reason:string;distance:number;health:number;targets:{x:number;z:number;yaw:number;index:number;distance:number;label:string}[];previous?:{x:number;z:number};recoveryAt?:number}
export const CITY_JOBS:readonly CityJob[];
export const CITY_JOB_KEY:string;
export function freshCityCareer():CityCareer;
export function normalizeCityCareer(raw:unknown):CityCareer;
export function cityCareerXP(profile:CityCareer):number;
export function loadCityCareer(storage?:Pick<Storage,'getItem'>):CityCareer;
export function saveCityCareer(storage:Pick<Storage,'setItem'>|undefined,profile:CityCareer):boolean;
export function createCityJob(id:string,track:Track):CityJobState;
export function stepCityJob(state:CityJobState,r:Racer,dt:number):CityJobState;
export function finishCityJob(profile:CityCareer,state:CityJobState):{profile:CityCareer;xp:number};
