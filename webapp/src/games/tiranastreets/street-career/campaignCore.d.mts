import type {Mission,Player,State} from '../shared/engine.mjs';
export type Loadout={cash:number;weapon:string;inventory:Record<string,{ammo:number;reserve:number}>};
export type StreetProfile={version:1;completed:string[];best:Record<string,number>;loadout:Loadout;active:null|{id:string;difficulty:string;checkpoint:Loadout}};
export type StoragePort=Pick<Storage,'getItem'|'setItem'>;
export const STREET_SAVE_KEY:string;
export const CHAPTER_IDS:readonly string[];
export function createCampaign(missions:readonly Mission[],weapons:readonly {id:string;magazine:number}[],starter:string):{
 chapters:readonly Mission[];fresh():StreetProfile;normalize(raw:unknown):StreetProfile;
 begin(raw:StreetProfile,id:string,difficulty?:string):StreetProfile|null;
 resolve(raw:StreetProfile,state:State,playerId:string):StreetProfile|null;
 abandon(raw:StreetProfile):StreetProfile;saveExplore(raw:StreetProfile,player:Player):StreetProfile;
 apply(player:Player,raw:Loadout):void;load(storage?:StoragePort):StreetProfile;save(storage:StoragePort|undefined,p:StreetProfile):boolean;
};
