export const STARTING_WEAPON_CHOICES:readonly string[];
export const DEFAULT_LOADOUT:readonly string[];
export function validStartingLoadout(ids:unknown):ids is readonly string[];
export function selectStartingLoadout(ids:readonly string[]):void;
export function selectedStartingLoadout():readonly string[]|null;
export function applyStartingLoadout(player:{inventory:Record<string,{ammo:number;reserve:number}>;weapon:string;reloadAt?:number},ids?:readonly string[]|null,fresh?:boolean):boolean;
