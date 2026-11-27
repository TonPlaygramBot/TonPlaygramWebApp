import {getBattleMission,recordBattleCareerResult} from './kartBattleCareer.mjs';
import {LAPS} from './simulation.mjs';

export const FIRST_BATTLE_MISSION_ID = 'ali-demi-01';
export const FIRST_BATTLE_COURSE_ID = 'tirana-brryli';
const verified = Object.freeze([FIRST_BATTLE_MISSION_ID]);

export function firstBattleEvent(missionId,courseId) {
  const mission = getBattleMission(missionId);
  return missionId === FIRST_BATTLE_MISSION_ID && courseId === FIRST_BATTLE_COURSE_ID
    && mission?.courseId === courseId && mission.format === 'classic' && mission.kind === 'race'
    && mission.criteria.opponents === 5 && mission.criteria.maxPlace === 3 ? mission : null;
}

export function recordFirstBattleFinish(progress,result) {
  const mission = firstBattleEvent(result?.battleCareerMission,result?.trackId);
  if (!mission || result.online !== false || result.captainDuel || result.timeTrial || result.combat
    || result.cityJob || result.actionCareer || result.playerId !== 'you' || result.racers?.length !== 6)
    return {accepted:false,xpAward:0,progress};
  const standings = result.racers;
  const me = standings.find(r=>r.id === result.playerId);
  const place = standings.indexOf(me)+1;
  const opponents = standings.filter(r=>r.id !== result.playerId);
  if (!me || me.ai || me.retired || me.disconnected || !Number.isFinite(me.finishTime) || me.finishTime <= 0
    || me.finishTime > result.elapsed || !Number.isFinite(result.elapsed)
    || me.lap !== LAPS+1 || me.lapTimes?.length !== LAPS || !me.lapTimes.every(t=>Number.isFinite(t) && t>0)
    || new Set(standings.map(r=>r.id)).size !== 6 || opponents.length !== 5
    || !opponents.every(r=>r.ai===true && /^ai-[1-5]$/.test(r.id)))
    return {accepted:false,xpAward:0,progress};
  return recordBattleCareerResult(progress,mission.id,{finished:me.finished===true,courseId:result.trackId,format:'classic',place,opponents:opponents.length},verified);
}
