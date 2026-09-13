import type {Vec2} from '../core';
import type {BattleMode} from './battlefield.mjs';
export type BotTarget=Vec2&{id:string;hp:number};
export type BotBrain={id:string;target:string|null;lastSeen:Vec2|null;seenAt:number;acquiredAt:number;ammo:number;reserve:number;reload:number;medkit:boolean;healTime:number;heardAt:number};
export type BotContext={mode?:BattleMode;zoneRadius?:number;intelCollected?:boolean;intelPoint?:Vec2;extractionPoint?:Vec2;covers?:Vec2[];reports?:Pick<BotBrain,'lastSeen'|'seenAt'>[];noise?:(Vec2&{at:number})|null;loot?:(Vec2&{id:string;ammo:number})[]};
export function createBrain(id:string):BotBrain;
export function thinkBot(brain:BotBrain,self:BotTarget,opponents:BotTarget[],now:number,dt:number,clear:(a:Vec2,b:Vec2)=>boolean,objective:Vec2,context?:BotContext):{target:BotTarget|null;goal:Vec2;fire:boolean;state:string;priority:boolean;heal:number;pickup:string|null};
