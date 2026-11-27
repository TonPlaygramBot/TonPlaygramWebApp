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

export const DRIFT_BATTLE_MISSION_ID = 'ali-demi-02';
export function secondBattleEvent(missionId,courseId) {
  const mission=getBattleMission(missionId);
  return missionId===DRIFT_BATTLE_MISSION_ID && courseId===FIRST_BATTLE_COURSE_ID
    && mission?.courseId===courseId && mission.kind==='drift' && mission.format==='drift'
    && mission.prerequisite===FIRST_BATTLE_MISSION_ID && Number.isFinite(mission.criteria.minDriftPoints)
    && mission.criteria.minDriftPoints>0 ? mission : null;
}

/** Read stock physics after each fixed tick. Only new forward track distance can score. */
export function createBattleDriftMeter(track) {
  let highWater=0, points=0;
  return {
    get points(){return Math.floor(points);},
    step(racer) {
      const progress=racer?.progress;
      if (!Number.isFinite(progress)||racer.finished||racer.retired||racer.disconnected||progress<=highWater) return;
      const distance=(progress-highWater)*track.length;
      highWater=progress;
      // Large jumps (e.g. recovery) consume the distance without scoring it.
      if (racer.drifting && !racer.airborne && !racer.reversing && racer.speed>8 && distance<=track.length*.012)
        points+=distance*2;
    }
  };
}

export function recordSecondBattleFinish(progress,result) {
  const mission=secondBattleEvent(result?.battleCareerMission,result?.trackId);
  if (!mission || result.online!==false || result.captainDuel || result.timeTrial || result.combat
    || result.cityJob || result.actionCareer || result.playerId!=='you'
    || !Number.isSafeInteger(result.battleDriftPoints) || result.battleDriftPoints<0)
    return {accepted:false,xpAward:0,progress};
  const me=result.racers?.find(r=>r.id==='you');
  if (!me || me.ai || me.retired || me.disconnected || me.finished!==true || me.lap!==LAPS+1
    || me.lapTimes?.length!==LAPS || !me.lapTimes.every(t=>Number.isFinite(t)&&t>0)
    || !Number.isFinite(me.finishTime) || me.finishTime<=0 || !Number.isFinite(result.elapsed) || me.finishTime>result.elapsed)
    return {accepted:false,xpAward:0,progress};
  return recordBattleCareerResult(progress,mission.id,{finished:true,courseId:result.trackId,
    format:'drift',driftPoints:result.battleDriftPoints},[DRIFT_BATTLE_MISSION_ID]);
}
