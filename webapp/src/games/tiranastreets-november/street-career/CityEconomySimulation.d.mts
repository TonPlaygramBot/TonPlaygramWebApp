import type {StreetSimulation,StreetAction} from './StreetSimulation.mjs';
import type {EconomySite} from './cityEconomyCatalog.mjs';
export type CityEconomyData={version:1;bank:number;owned:string[];stash:Record<string,Record<string,number>>;cooldowns:Record<string,number>};
export type EconomyAction='purchase'|'deposit'|'withdraw'|'store'|'take'|'rob';
export const ECONOMY_LIMIT:number;
export const BANK_HOLD_SECONDS:number;
export const BANK_COOLDOWN_SECONDS:number;
export function normalizeCityEconomy(raw?:unknown):CityEconomyData;
export class CityEconomySimulation {
 constructor(sim:StreetSimulation,raw?:unknown,sites?:EconomySite[]);
 sim:StreetSimulation;sites:EconomySite[];data:CityEconomyData;selectedId:string|null;
 robbery:{siteId:string;phase:'hold'|'escape';remaining:number;reward:number}|null;
 readonly selected:EconomySite|null;readonly blockedReason:string;
 restore(raw?:unknown):void;snapshot():CityEconomyData;owns(id:string):boolean;
 near(site:EconomySite,entrance?:boolean):boolean;candidates():StreetAction[];execute(action:StreetAction):boolean;
 transact(action:EconomyAction,id:string,amount?:number,weapon?:string):boolean;
 step(dt:number):void;objective():{title:string;detail:string;training:false}|null;
}
