import type {Racer,Track} from './simulation.mjs';
export interface CombatWeapon {
  ammo:number;reserve:number;reload:number;cooldown:number;shield:number;shieldActive:boolean;
  kills:number;hits:number;score:number;supplies:number;pulseCooldown:number;disrupted:number;aiCooldown:number;windup:number;aim:number;targetId:string;
}
export interface CombatProjectile {
  id:number;ownerId:string;x:number;y:number;z:number;previousX:number;previousZ:number;
  vx:number;vz:number;travel:number;hint:number;
}
export interface CombatPickup {id:number;kind:'ammo'|'repair'|'shield'|'charge';x:number;z:number;cooldown:number;}
export interface CombatWarning {id:string;ownerId:string;targetId:string;x:number;z:number;yaw:number;remaining:number;}
export interface CombatBurst {id:number;x:number;y:number;z:number;kind:'muzzle'|'impact'|'explosion'|'pickup'|'pulse';ownerId:string;age:number;}
export interface RaceCombatState {
  playerId:string;player:CombatWeapon;weapons:Record<string,CombatWeapon>;
  previous:Record<string,{x:number;y:number;z:number}>;pickups:CombatPickup[];
  projectiles:CombatProjectile[];warnings:CombatWarning[];bursts:CombatBurst[];elapsed:number;serial:number;shotId:number;explosionId:number;
}
export interface CombatInput {fire?:boolean;shield?:boolean;reload?:boolean;pulse?:boolean;}
export const COMBAT_RULES:Readonly<{
  magazine:number;reserve:number;reserveMax:number;reloadSeconds:number;shotInterval:number;shotSpeed:number;
  shotDamage:number;range:number;warningSeconds:number;shieldMax:number;shieldDrain:number;shieldRecharge:number;
  pickupRespawn:number;maxProjectiles:number;maxBursts:number;maxPickups:number;
  pulseRadius:number;pulseRecharge:number;pulseDisrupt:number;pulseDamage:number;
}>;
export function createRaceCombat(track:Track,racers:Racer[],playerId?:string):RaceCombatState;
export function stepRaceCombat(state:RaceCombatState,racers:Racer[],track:Track,input:CombatInput,dt:number,time?:number,inputsById?:Record<string,CombatInput>):void;
