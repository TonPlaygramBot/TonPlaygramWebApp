import {describe,it,expect} from 'vitest';
import {FIRST_BATTLE_MISSION_ID as id,FIRST_BATTLE_COURSE_ID as course,firstBattleEvent,recordFirstBattleFinish} from './battleCareerClassic.mjs';
import {BATTLE_CREWS,normalizeBattleCareerProgress} from './kartBattleCareer.mjs';
import {LAPS,makeTrack,createRacer,equipKart,stepRace,standings} from './simulation.mjs';

const empty=normalizeBattleCareerProgress();
const rivals=Array.from({length:5},(_,i)=>({id:`ai-${i+1}`,ai:true,finished:false}));
const player={id:'you',finished:true,finishTime:95,lap:LAPS+1,lapTimes:[32,31,32]};
const success={battleCareerMission:id,trackId:course,online:false,elapsed:95,racers:[player,...rivals],playerId:'you'};
describe('verified Battle Career adapter',()=>{
 it('exposes only the official fixed classic event in the 56-mission catalogue',()=>{
  const all=BATTLE_CREWS.flatMap(c=>c.missions);
  expect(all.filter(m=>firstBattleEvent(m.id,m.courseId)).map(m=>m.id)).toEqual([id]);
  expect(firstBattleEvent(id,'wrong')).toBeNull();
  expect(makeTrack(course).id).toBe(course);
 });
 it('rejects wrong modes, non-podium, partial finishes and invalid opponent grids',()=>{
  for (const variation of [
   {online:true},{online:undefined},{timeTrial:true},{captainDuel:true},{battleCareerMission:'ali-demi-08'},
   {battleCareerMission:undefined},{trackId:'wrong'},{combat:{}},{elapsed:94},
   {racers:[...rivals,player]}, {racers:[{...player,finished:false},...rivals]},
   {racers:[{...player,lapTimes:[32,31]},...rivals]},
   {racers:[player,...rivals.slice(1),rivals[1]]},{racers:[player,...rivals.slice(1)]}
  ]) expect(recordFirstBattleFinish(empty,{...success,...variation}).accepted).toBe(false);
 });
 it('records podium XP once and cannot activate the official boss',()=>{
  const third={...success,racers:[...rivals.slice(0,2),player,...rivals.slice(2)]};
  const report=recordFirstBattleFinish(empty,third);
  expect(report).toMatchObject({accepted:true,xpAward:350,progress:{xp:350,completedMissionIds:[id]}});
  expect(recordFirstBattleFinish(report.progress,third)).toMatchObject({accepted:false,xpAward:0});
  expect(recordFirstBattleFinish(report.progress,{...success,battleCareerMission:'ali-demi-08'}).accepted).toBe(false);
 });
 it('finishes a real fixed-step six-kart Brryli grid and consumes its standings',()=>{
  const track=makeTrack(course);
  const racers=Array.from({length:6},(_,i)=>createRacer(track,i?`ai-${i}`:'you',`Kart ${i}`,i,true));
  racers.forEach(r=>equipKart(r,'apex'));
  let elapsed=0;
  while(!racers[0].finished&&elapsed<240) {elapsed+=1/60;stepRace(racers,track,1/60,elapsed,'rookie');}
  const ranked=standings(racers);
  expect(racers[0].finished).toBe(true);
  expect(racers[0].lapTimes).toHaveLength(LAPS);
  // All seats were driven by the deterministic stock AI for repeatable engine coverage.
  racers[0].ai=false;
  const awarded=recordFirstBattleFinish(empty,{...success,elapsed,racers:ranked});
  expect(awarded.accepted).toBe(ranked.indexOf(racers[0])<3);
 });
});
