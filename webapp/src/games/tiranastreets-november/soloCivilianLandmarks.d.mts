export const BALLET_BUILDING_ID: '443993963';
export const BALLET_CAMPUS_ID: 'way/541840626';
export const GRAMENO_MAP_ID: 'node/9124938870';
export function balletSchoolMapPlace(world: {buildings: readonly unknown[]; roads: readonly unknown[]}, existing?: readonly {id?:string;name:string}[], sites?: readonly unknown[]): {id:string;name:string;x:number;z:number}|null;
export function gramenoMemorial(places?: readonly unknown[]): {x:number;z:number}|null;
