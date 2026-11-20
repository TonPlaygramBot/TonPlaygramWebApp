import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,KARTS,makeTrack} from '../webapp/src/games/kartroyale/simulation.mjs';
import {careerStages,normalizeStreetCareer,finishStreetStage,stageUnlocked,loadStreetCareer,saveStreetCareer} from '../webapp/src/games/kartroyale/streetCareer.mjs';
test('all actual20 urban routes unlock sequentially and reload without repeat rewards',()=>{
 const stages=careerStages(TRACKS);assert.equal(stages.length,20);
 let profile=normalizeStreetCareer({},TRACKS,KARTS),total=0,saved;
 const store={setItem:(_,v)=>{saved=v;},getItem:()=>saved};
 for(let i=0;i<stages.length;i++){
  const stage=stages[i];assert.equal(makeTrack(stage.id).id,stage.id);
  assert.equal(stageUnlocked(profile,stages,stage.id),true);
  if(i+1<stages.length)assert.equal(stageUnlocked(profile,stages,stages[i+1].id),false);
  const result={trackId:stage.id,playerId:'me',racers:[{id:'me',finished:true,finishTime:120+i,health:100}]};
  const out=finishStreetStage(profile,TRACKS,KARTS,stage.id,result);
  assert.equal(out.bonus,stage.reward+100);total+=out.bonus;
  profile=out.profile;assert.equal(profile.xp,total);
  assert.equal(saveStreetCareer(store,profile),true);profile=loadStreetCareer(store,TRACKS,KARTS);
  assert.equal(finishStreetStage(profile,TRACKS,KARTS,stage.id,result).bonus,0);
 }
 assert.equal(Object.keys(profile.completed).length,20);
 const equipped=normalizeStreetCareer({...profile,loadout:{...profile.loadout,ammo:'double',shield:'double'}},TRACKS,KARTS);
 assert.equal(equipped.loadout.ammo,'double');assert.equal(equipped.loadout.shield,'double');
});
test('retired rural career records cannot unlock current city stages',()=>{
 const p=normalizeStreetCareer({completed:{farke:true,surrel:true,liqeni:true},xp:99999},TRACKS,KARTS);
 assert.equal(p.xp,0);assert.equal(Object.keys(p.completed).length,0);
 assert.equal(stageUnlocked(p,careerStages(TRACKS),TRACKS[1].id),false);
});
