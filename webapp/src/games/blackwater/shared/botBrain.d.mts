import type {Vec2} from '../core';
export type BotTarget=Vec2&{id:string;hp:number};
export type BotBrain={id:string;target:string|null;lastSeen:Vec2|null;seenAt:number;acquiredAt:number;ammo:number;reload:number;medkit:boolean};
export function createBrain(id:string):BotBrain;
export function thinkBot(brain:BotBrain,self:BotTarget,opponents:BotTarget[],now:number,dt:number,clear:(a:Vec2,b:Vec2)=>boolean,objective:Vec2):{target:BotTarget|null;goal:Vec2;fire:boolean;state:string};
