import test from 'node:test';
import assert from 'node:assert/strict';
import {coverPoint,tacticalGoal,tacticalFireReady,recordTacticalShot,pursuitGoal} from '../webapp/src/games/tiranastreets/shared/forceTactics.mjs';
import {harm,updateCityLife} from '../webapp/src/games/tiranastreets/shared/cityLife.mjs';
const npc=(id,x=0,z=0)=>({id,kind:'gang',health:65,x,z,heading:0,speed:0,motion:'walk',weapon:'ak47VolleyAttack',nextShot:0});
const target={x:0,z:-20};
const clear=()=>true;

test('flankers commit to a fixed reachable point, stop and engage before selecting another move',()=>{
  const squad=[npc('a',-8),npc('b',8),npc('c'),npc('d',5)],n=squad[2];
  const first=tacticalGoal(n,target,squad,[],10,clear);
  assert.equal(first.anim,'run');
  Object.assign(n,{x:first.goal.x*.2,z:first.goal.z*.2});
  const next=tacticalGoal(n,target,squad,[],10.2,clear);
  assert.deepEqual(next.goal,first.goal,'movement cannot continuously rotate the flank destination');
  const firing=tacticalGoal(n,target,squad,[],13.1,clear);
  assert.equal(firing.anim,'aim');assert.equal(firing.goal,n);
  assert.equal(tacticalGoal(n,target,squad,[],15.9,clear).anim,'aim');
  const blocked=npc('z');
  assert.notEqual(tacticalGoal(blocked,target,[...squad,blocked],[],10,(a,b)=>b===target).anim,'run');
});

test('a damaged enemy seeks reachable cover with four bounded probes and reuses the accepted plan',()=>{
  const n=npc('a');n.lastDamage=5;
  const cars=Array.from({length:9},(_,i)=>({id:String(i),x:i+1,z:-3,w:2,d:4.6,heading:0}));
  let probes=0;
  const walkClear=(a,b)=>{if(b===target)return true;probes++;return b.x>7;};
  let decision=tacticalGoal(n,target,[n],cars,5.1,walkClear);
  assert.equal(decision.anim,'cover');assert.equal(probes,4);
  for(let i=0;i<20;i++)tacticalGoal(n,target,[n],cars,5.15+i*.01,walkClear);
  assert.equal(probes,4,'unsuccessful routes are not retried every simulation step');
  decision=tacticalGoal(n,target,[n],cars,5.8,walkClear);
  assert.ok(decision.coverId);assert.ok(probes<=8);
  const accepted=probes;
  tacticalGoal(n,target,[n],cars,5.9,walkClear);assert.equal(probes,accepted);
});

test('vehicle cover remains usable while hidden and a recent hit prevents exposing a peek',()=>{
  const car={id:'car',x:0,z:0,w:2,d:4.6,heading:0};
  const n={...npc('a'),...coverPoint(car,target,0),coverId:car.id,lastDamage:7.1,lastSeen:{...target},lastSeenAt:7};
  const suppressed=tacticalGoal(n,target,[n],[car],7.2,clear);
  assert.equal(suppressed.anim,'cover');assert.deepEqual(suppressed.goal,coverPoint(car,target));
  const hidden=tacticalGoal(n,{x:900,z:900},[n],[car],7.3,clear,{observed:false});
  assert.equal(hidden.coverId,car.id);assert.deepEqual(hidden.goal,suppressed.goal);
  assert.equal(n.lastSeenAt,7.2,'a remembered hidden location does not become a new observation');
  assert.equal(tacticalGoal(n,target,[n],[car],25,clear,{observed:false}).anim,'idle');
});

test('dead, stale and future squad reports cannot locate a hidden target or redirect a pursuit',()=>{
  const n=npc('self'),reports=[{...npc('future'),lastSeen:{x:40,z:40},lastSeenAt:100},
    {...npc('dead'),health:0,lastSeen:{x:50,z:50},lastSeenAt:9}];
  assert.equal(tacticalGoal(n,target,[n,...reports],[],10,()=>false).anim,'idle');
  reports.push({...npc('live'),lastSeen:{x:4,z:5},lastSeenAt:9});
  let decision=tacticalGoal(n,{x:100,z:100},[n,...reports],[],10,clear,{observed:false});
  assert.deepEqual(decision.goal,{x:4,z:5});assert.equal(n.lastSeenAt,9);
  decision=tacticalGoal(n,{x:999,z:999},[n,...reports],[],22,clear,{observed:false});
  assert.equal(decision.anim,'idle');assert.equal(n.lastSeenAt,9);
  const unit={id:'unit',x:0,z:0};
  assert.equal(pursuitGoal(unit,target,[{...reports[0],lastSeen:{x:99,z:99,speed:0,heading:0}}],10,false).role,'hold');
});

test('three actual shots create a breathing pause; recent injury gates fire but blocked attempts do not',()=>{
  const n=npc('a');
  for(const time of [1,1.4,1.8]){assert.equal(tacticalFireReady(n,time),true);recordTacticalShot(n,time);}
  assert.equal(tacticalFireReady(n,2),false);assert.equal(tacticalFireReady(n,3.1),true);
  n.lastDamage=3;assert.equal(tacticalFireReady(n,3.9),false);assert.equal(tacticalFireReady(n,4.2),true);
  for(let i=0;i<40;i++)tacticalFireReady(n,4.3);assert.equal(n.burstShots,0,'ready queries never count shots');
  recordTacticalShot(n,9);assert.equal(n.burstShots,1,'a long break starts a fresh burst');
});

function fixture(fireNPC){
  const p={id:'player',x:0,z:-15,heading:0,speed:0,health:100,armor:0,weapon:'',inventory:{},lastDamage:-10,lastCrime:0,wanted:0,inputAt:-10,input:{}};
  const n=npc('gang');
  const state={elapsed:0,difficulty:'normal',missionId:'free-roam',players:{player:p},npcs:[n],cars:[],traffic:[],units:[],policeVersion:1,dispatchQueue:{},effects:[],effectSeq:0};
  const env={world:{roads:[],graph:{nodes:[],edges:[]}},clear,collide(){},along(){},fireNPC:fireNPC&&((...args)=>fireNPC(state,...args))};
  return {state,n,p,env,step(time){state.elapsed=time;updateCityLife(state,1/60,env,{type:'free'});}};
}

test('actual city update only records emitted weapon shots and stops firing immediately after an injury',()=>{
  let emitted=false;
  const f=fixture((s,n)=>{if(emitted){n.firedAt=s.elapsed;n.nextShot=s.elapsed+.1;}});
  f.step(0);f.step(.3);f.step(.4);assert.equal(f.n.burstShots,undefined);
  emitted=true;f.step(.5);f.step(.7);f.step(.9);
  assert.equal(f.n.burstShots,0);const last=f.n.firedAt;
  f.step(1.1);assert.equal(f.n.firedAt,last);
  f.step(2.3);assert.equal(f.n.firedAt,2.3);
  harm(f.state,f.n,5,f.p,f.env);assert.equal(f.n.lastDamage,2.3);
  f.step(2.5);assert.equal(f.n.firedAt,2.3);assert.equal(f.n.anim,'cover');
  f.step(3.6);f.step(3.9);assert.equal(f.n.firedAt,3.9);
});

test('invalid damage cannot corrupt health, suppress an actor, or count as a hit',()=>{
  const f=fixture();
  for(const amount of [NaN,Infinity,-10,0])harm(f.state,f.n,amount,f.p,f.env);
  assert.equal(f.n.health,65);assert.equal(f.n.lastDamage,undefined);assert.equal(f.state.effects.length,0);
});

test('the live city tracker preserves the original observation time while following a report',()=>{
  const f=fixture(()=>{});let hidden=false,remembered;
  f.env.track=(n,p)=>hidden?{...p,...remembered}:p;
  f.step(1);remembered={x:f.p.x,z:f.p.z};const seenAt=f.n.lastSeenAt;
  hidden=true;f.p.x=500;f.p.z=500;
  for(const time of [2,4,6,8,10])f.step(time);
  assert.equal(f.n.lastSeenAt,seenAt);assert.deepEqual(f.n.lastSeen,remembered);
  f.step(14);assert.equal(f.n.anim,'idle');assert.equal(f.n.firedAt,undefined);
});

test('a peek blocked by a wall keeps the actor behind the vehicle',()=>{
  const car={id:'car',x:0,z:0,w:2,d:4.6,heading:0};
  const behind=coverPoint(car,target,0),n={...npc('a'),...behind,coverId:'car'};
  const decision=tacticalGoal(n,target,[n],[car],0,(a,b)=>b===target||Math.abs(b.x-behind.x)<.1);
  assert.equal(decision.anim,'cover');assert.deepEqual(decision.goal,behind);
});


test('stationary reload remains visibly active until the weapon deadline',()=>{
  const n={...npc('reloader'),reloadUntil:4};
  assert.equal(tacticalGoal(n,target,[n],[],2,clear).anim,'reload');
  assert.equal(tacticalGoal(n,{x:0,z:-15},[n],[],4.1,clear).anim,'aim');
});
