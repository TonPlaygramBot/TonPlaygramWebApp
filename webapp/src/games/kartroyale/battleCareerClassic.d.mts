import type {BattleMission,BattleProgress} from './kartBattleCareer.mjs';
import type {Result} from './renderer';
export const FIRST_BATTLE_MISSION_ID: 'ali-demi-01';
export const FIRST_BATTLE_COURSE_ID: 'tirana-brryli';
export function firstBattleEvent(missionId?: string,courseId?: string): BattleMission|null;
export function recordFirstBattleFinish(progress: BattleProgress,result: Result):
  {progress: BattleProgress; xpAward:number; accepted:boolean};

export const DRIFT_BATTLE_MISSION_ID: 'ali-demi-02';
export function secondBattleEvent(missionId?: string,courseId?: string): BattleMission|null;
export function createBattleDriftMeter(track:{length:number}): {
  readonly points:number;
  step(racer?:{progress:number;finished?:boolean;retired?:boolean;disconnected?:boolean;drifting?:boolean;airborne?:boolean;reversing?:boolean;speed:number}):void;
};
export function recordSecondBattleFinish(progress: BattleProgress,result: Result):
  {progress: BattleProgress; xpAward:number; accepted:boolean};
