import {it,expect} from 'vitest';
import {createBattleDriftMeter,recordSecondBattleFinish,secondBattleEvent} from './battleCareerClassic.mjs';
import {makeTrack,stepRace,createRacer,equipKart,aiInput} from './simulation.mjs';

const course='tirana-brryli',event='ali-demi-02';
const unlocked={version:1,completedMissionIds:['ali-demi-01'],xp:350};
const result={battleCareerMission:event,battleDriftPoints:200,trackId:course,online:false,playerId:'you',elapsed:158,
  racers:[{id:'you',lap:4,finished:true,finishTime:157,lapTimes:[53,52,52]}]};
it('only activates the catalogued second drift mission; rejects inadequate, locked or wrong finish evidence',()=>{
 expect(secondBattleEvent(event,course).criteria.minDriftPoints).toBe(200);
 expect(secondBattleEvent(event,'other')).toBeNull();
 expect(secondBattleEvent('ali-demi-03',course)).toBeNull();
 expect(recordSecondBattleFinish({},result).accepted).toBe(false);
 for(const override of [{online:true},{online:undefined},{timeTrial:true},{captainDuel:true},{combat:{}},{trackId:'wrong'},
   {battleCareerMission:'ali-demi-01'},{battleDriftPoints:199},{battleDriftPoints:Infinity},{elapsed:155},
   {racers:[{...result.racers[0],finished:false}]}])
   expect(recordSecondBattleFinish(unlocked,{...result,...override}).accepted).toBe(false);
 const won=recordSecondBattleFinish(unlocked,result);
 expect(won).toMatchObject({accepted:true,xpAward:375,progress:{xp:725,completedMissionIds:['ali-demi-01',event]}});
 expect(recordSecondBattleFinish(won.progress,result).xpAward).toBe(0);
});
it('only counts new forward course distance with post-physics active steered drift',()=>{
 const score=createBattleDriftMeter({length:1000}),kart={progress:.005,speed:14,drifting:true};
 score.step(kart);expect(score.points).toBe(10);
 for(const variation of [{progress:.003},{progress:.005},{progress:.007,reversing:true},{progress:.01,airborne:true},
   {progress:.013,drifting:false},{progress:.016,speed:2},{progress:.055},{progress:4,finished:true}])
   score.step({...kart,...variation});
 expect(score.points).toBe(10);
});
it('drift target and all three laps can be achieved on the actual six-kart Brryli engine',()=>{
 const track=makeTrack(course);
 for(const deliberate of [false,true]){
  const meter=createBattleDriftMeter(track);
  const racers=Array.from({length:6},(_,i)=>createRacer(track,i?`ai-${i}`:'you','test',i,i>0));
  racers.forEach(r=>equipKart(r,'apex'));
  const player=racers[0];
  let elapsed=0;
  while(!player.finished&&elapsed<240){
   elapsed+=1/60;
   const input=aiInput(player,track,elapsed,'rookie',racers);
   player.input=deliberate?{...input,drift:Math.abs(input.steer)>.25&&!input.brake}:input;
   stepRace(racers,track,1/60,elapsed,'rookie');
   meter.step(player);
  }
  expect(player.finished).toBe(true);
  expect(player.lapTimes).toHaveLength(3);
  expect(recordSecondBattleFinish(unlocked,{...result,elapsed,racers,battleDriftPoints:meter.points}).accepted).toBe(deliberate);
 }
});
