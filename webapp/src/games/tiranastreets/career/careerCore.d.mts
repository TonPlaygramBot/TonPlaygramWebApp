export type Step={place:string;text:string;action:string};
export type Chapter={id:string;title:string;contact:string;reward:number;limit?:number;steps:readonly Step[]};
export type Profile={version:number;completed:string[];bestTimes:Record<string,number>;active:null|{id:string;step:number;elapsed:number;status:string;reason:string}};
export const CHAPTERS:readonly Chapter[];export const SAVE_KEY:string;
export function freshCareer():Profile;export function normalizeCareer(raw:unknown):Profile;
export function loadCareer(storage:Storage|undefined):Profile;export function saveCareer(storage:Storage|undefined,p:Profile):boolean;
export function careerBalance(p:Profile):number;export function startChapter(p:Profile,id:string):Profile;
export function currentStep(p:Profile):Step|null;export function advanceCareer(p:Profile,e:any):Profile;
export function accessPoint(world:any,anchor:{x:number;z:number},walkable:(p:{x:number;z:number})=>boolean):{x:number;z:number;distance:number}|null;
