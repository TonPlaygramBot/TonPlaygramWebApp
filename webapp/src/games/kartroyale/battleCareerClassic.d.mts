import type {BattleMission,BattleProgress} from './kartBattleCareer.mjs';
import type {Result} from './renderer';
export const FIRST_BATTLE_MISSION_ID: 'ali-demi-01';
export const FIRST_BATTLE_COURSE_ID: 'tirana-brryli';
export function firstBattleEvent(missionId?: string,courseId?: string): BattleMission|null;
export function recordFirstBattleFinish(progress: BattleProgress,result: Result):
  {progress: BattleProgress; xpAward:number; accepted:boolean};
