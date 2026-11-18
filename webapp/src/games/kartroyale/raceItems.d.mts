import type { Racer, Track } from './simulation.mjs';
export type RaceItemKind = 'rocket' | 'shield' | 'boost';
export interface RaceItemRocket { id:number; index:number; x:number; y:number; z:number; vx:number; vz:number; life:number }
export interface RaceItemPickup { id:number; x:number; z:number; yaw:number; index:number; distance:number; kind:RaceItemKind }
export const RACE_ITEM_RULES: Readonly<{pickupRadius:number;pickupCooldown:number;shieldDuration:number;boostDuration:number;rocketSpeed:number;rocketLife:number;rocketRadius:number;hitSpeedFactor:number;hitImmunity:number;maxPickups:number}>;
export function raceItemPickups(track:Track):RaceItemPickup[];
export function initializeRaceItems(r:Racer):void;
export function shouldAIUseRaceItem(r:Racer,racers:Racer[],track:Track,time:number):boolean;
export function stepRaceItems(racers:Racer[],track:Track,dt:number,time:number,previousPositions?:{x:number;z:number}[]):void;
