import type {Vec2,Obstacle} from '../core';
export type BattleMode='last-stand'|'sweep'|'hold'|'extraction'|'waves';
export const BATTLE_MODES:readonly {id:BattleMode;name:string;description:string}[];
export const OPERATIONS:readonly {id:string;map:import('../core').BattlefieldMapId;mode:BattleMode;title:string}[];
export function sectorObstacles(center:Vec2,radius?:number,obstacles?:readonly Obstacle[]):Obstacle[];
export function sectorSpawns(mapId:string,count?:number,obstacles?:readonly Obstacle[]):Vec2[];
export function zoneRadius(elapsed:number):number;
export function normalizeOperations(raw:unknown):{completed:string[]};
export function finishOperation(raw:unknown,id:string,won:boolean):{completed:string[]};
