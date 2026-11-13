import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrain, thinkBot} from '../webapp/src/games/blackwater/shared/botBrain.mjs';
import {advanceBattleObjective} from '../webapp/src/games/blackwater/shared/missionCore.mjs';
const self = {id:'0', x:0, z:0, hp:100};
const enemy = {id:'player', x:0, z:-18, hp:100};
const clear = () => true;
const state = () => ({progress:0, intel:false, extracting:false, extraction:0});
const frame = mode => ({mode, elapsed:10, wave:1, health:100, driving:false, lastDamage:-100,
  player:{x:0,z:0}, center:{x:0,z:0}, intelPoint:{x:15,z:0}, extractionPoint:{x:30,z:0}, enemies:[{x:40,z:0,hp:100}]});
function advance(s, f, seconds) {
  for (let i=0; i<Math.round(seconds*60); i++) {f.elapsed += 1/60; s = advanceBattleObjective(s,f,1/60);}
  return s;
}

test('facing perception, sound investigation and reacquisition do not reveal a hidden opponent', () => {
  const b=createBrain('0'), guard={...self,yaw:0}, behind={...enemy,z:20};
  let d=thinkBot(b,guard,[behind],1,.1,clear,self);
  assert.equal(d.target,null); assert.equal(d.fire,false);
  d=thinkBot(b,guard,[{...behind,x:35}],2,.1,()=>false,self,{noise:{x:0,z:20,at:1.9}});
  assert.deepEqual(d.goal,{x:0,z:20}); assert.equal(d.target,null);
  d=thinkBot(b,{...guard,yaw:Math.PI},[behind],2.1,.1,clear,self);
  assert.equal(d.target.id,'player'); assert.equal(d.fire,false);
  assert.equal(thinkBot(b,{...guard,yaw:Math.PI},[behind],2.8,.1,clear,self).fire,true);
  d=thinkBot(b,guard,[],14,.1,clear,self,{reports:[{lastSeen:{x:99,z:99},seenAt:30}]});
  assert.deepEqual(d.goal,{x:0,z:0},'future reports cannot provide omniscient search orders');
});

test('three actual shots cause a breathing pause and allies block the firing lane', () => {
  const b=createBrain('0'); thinkBot(b,self,[enemy],0,.1,clear,self);
  for(const time of [1,1.1,1.2]) {assert.equal(thinkBot(b,self,[enemy],time,.1,clear,self).fire,true); b.ammo--;}
  assert.equal(thinkBot(b,self,[enemy],1.3,.1,clear,self).fire,false);
  assert.equal(thinkBot(b,self,[enemy],2,.1,clear,self).fire,true);
  const allies=[{id:'1',x:0,z:-9,hp:100}];
  assert.equal(thinkBot(b,self,[enemy],2.1,.1,clear,self,{allies}).fire,false);
  allies[0].x=2;
  assert.equal(thinkBot(b,self,[enemy],2.2,.1,clear,self,{allies}).fire,true);
});

test('suppressed operators use reachable vacant cover with a bounded pathfinding budget', () => {
  const b=createBrain('0');thinkBot(b,self,[enemy],0,.1,clear,self);
  let paths=0;
  const context={covers:Array.from({length:20},(_,i)=>({x:i+2,z:0})),allies:[{id:'friend',x:2,z:0}],canReach:(a,p)=>{paths++;return p.x>=6;}};
  const los=(a)=>a.x===0;
  let d=thinkBot(b,{...self,hp:72},[enemy],1,.016,los,self,context);
  assert.equal(d.state,'cover');assert.deepEqual(d.goal,{x:6,z:0});assert.equal(d.fire,false);
  const initialPaths=paths;
  for(let i=1;i<25;i++)d=thinkBot(b,{...self,hp:72},[enemy],1+i/60,1/60,los,self,context);
  assert.ok(initialPaths<=4);assert.equal(paths,initialPaths,'cached reachable cover is reused between decision ticks');
  assert.equal(d.anim,'cover');
});

test('squad fire support holds while flankers alternate movement and deliberate firing', () => {
  const actors=[self,{id:'1',x:3,z:0,hp:100},{id:'2',x:-3,z:0,hp:100},{id:'3',x:6,z:0,hp:100}];
  const decisions=actors.map(actor=>thinkBot(createBrain(actor.id),actor,[enemy],1,.1,clear,self,{allies:actors}));
  assert.equal(decisions[0].role,'support');assert.equal(decisions[0].anim,'aim');
  assert.equal(decisions[2].role,'flank');assert.equal(decisions[2].state,'flank');
  assert.notDeepEqual(decisions[2].goal,decisions[3].goal);
  const actor=actors[2],b=createBrain(actor.id),ctx={allies:actors};
  let d=thinkBot(b,actor,[enemy],1,.1,clear,self,ctx);assert.equal(d.state,'flank');
  d=thinkBot(b,actor,[enemy],4.6,.1,clear,self,ctx);
  assert.equal(d.state,'aim');assert.equal(d.fire,true,'flankers stop to engage rather than orbit forever');
});

test('reloading a partial magazine conserves every round and holds fire during cover movement', () => {
  const b=createBrain('0');b.ammo=0;b.reserve=5;
  let d;
  for(let i=0;i<180;i++)d=thinkBot(b,self,[],i/60,1/60,clear,self);
  assert.equal(b.ammo,5);assert.equal(b.reserve,0);assert.equal(d.fire,false);
  assert.equal(b.ammo+b.reserve,5);
});

test('intel requires an uncontested undamaged interaction and explains each blocking condition', () => {
  const f=frame('extraction'); f.player={...f.intelPoint};f.enemies[0]={...f.intelPoint,hp:100};
  let s=advance(state(),f,4);assert.equal(s.intel,false);assert.equal(s.contested,true);assert.equal(s.stage,'collect');
  f.enemies[0].x=40;s=advance(s,f,1);assert.ok(s.progress>0);
  f.lastDamage=f.elapsed;s=advanceBattleObjective(s,f,1/60);assert.equal(s.progress,0);assert.match(s.hint,/Taking fire/);
  s=advance(s,f,4);assert.equal(s.intel,true);assert.equal(s.stage,'escape');assert.deepEqual(s.objectivePosition,f.extractionPoint);
  f.player={...f.extractionPoint};s=advance(s,f,2);assert.ok(s.progressRatio>0&&s.progressRatio<1);
  f.enemies[0].x=f.extractionPoint.x;s=advance(s,f,1);assert.equal(s.extraction,0);assert.equal(s.contested,true);
  f.enemies[0].hp=0;s=advance(s,f,6);assert.equal(s.status,'won');assert.equal(s.stage,'complete');
});

test('defense checkpoints retain earned progress while an abandoned contested capture loses only its current segment', () => {
  const f=frame('hold');let s=advance(state(),f,22);
  assert.ok(s.progress>21);f.player.x=30;f.enemies[0].x=0;
  s=advance(s,f,25);assert.equal(s.progress,15);assert.equal(s.contested,true);assert.equal(s.stage,'contest');
  f.player.x=0;s=advance(s,f,3);assert.equal(s.progress,15,'standing inside a contested zone holds earned progress');
  f.enemies[0].x=40;s=advance(s,f,31);assert.equal(s.status,'won');assert.equal(s.progressRatio,1);
});

test('mission director validates time deltas and supplies extraction guidance without premature rewards', () => {
  const f=frame('sweep');let s=advanceBattleObjective(state(),f,NaN);
  assert.equal(s.status,'playing');assert.equal(s.stage,'eliminate');assert.equal(s.progressRatio,0);
  f.enemies[0].hp=0;s=advanceBattleObjective(s,f,1/60);assert.equal(s.extractionOpened,true);assert.equal(s.stage,'escape');
  f.player={...f.extractionPoint};s=advanceBattleObjective(s,f,999);assert.equal(s.extraction,.25);assert.equal(s.status,'playing');
  f.driving=true;s=advanceBattleObjective(s,f,.1);assert.equal(s.extraction,0);assert.match(s.hint,/vehicle/);
  f.driving=false;s=advance(s,f,6);assert.equal(s.status,'won');
  f.health=0;assert.equal(advanceBattleObjective(s,f,.1).status,'lost');
});

test('a whole defender squad gets separated objective positions instead of stacking sequential IDs on one corner', () => {
  const defenders=Array.from({length:8},(_,i)=>({id:String(i),x:40+i,z:0,hp:100}));
  const goals=defenders.map(actor=>thinkBot(createBrain(actor.id),actor,[],1,.1,clear,self,{mode:'hold',allies:defenders}).goal);
  for(let i=0;i<goals.length;i++)for(let j=i+1;j<goals.length;j++)assert.ok(Math.hypot(goals[i].x-goals[j].x,goals[i].z-goals[j].z)>2.5);
  assert.ok(goals.every(goal=>Math.hypot(goal.x,goal.z)<10),'every position can contest the beacon');
});

test('bounded cover searches eventually reach later candidates and healthy operators do not spend paths on cover', () => {
  const b=createBrain('0'), covers=Array.from({length:10},(_,i)=>({x:i+2,z:0}));
  let paths=0;
  const ctx={covers,canReach:(a,p)=>{paths++;return p.x===8;}};
  const los=a=>a.x===0;
  thinkBot(b,self,[enemy],0,.1,los,self,ctx);assert.equal(paths,0);
  let d=thinkBot(b,{...self,hp:25},[enemy],1,.1,los,self,ctx);
  assert.equal(d.state,'retreat');assert.equal(paths,4);
  d=thinkBot(b,{...self,hp:25},[enemy],1.8,.1,los,self,ctx);
  assert.equal(d.state,'cover');assert.deepEqual(d.goal,{x:8,z:0});assert.equal(paths,7);
  d=thinkBot(b,{...self,hp:25},[enemy],2.6,.1,los,self,ctx);
  assert.deepEqual(d.goal,{x:8,z:0});assert.equal(paths,8,'successful cover remains stable');
});
