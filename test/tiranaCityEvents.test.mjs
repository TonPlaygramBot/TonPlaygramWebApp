import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityEvent,updateCityEvent,cityEventIntent,stopCityEvent,issueUnitOrder,acceptUnitOrder,cityEventRoadGap,cityEventRoadBlocked} from '../webapp/src/games/tiranastreets/shared/cityEvents.mjs';
import {createState,collide} from '../webapp/src/games/tiranastreets/shared/engine.mjs';
import {tacticalGoal,forceBehavior} from '../webapp/src/games/tiranastreets/shared/forceTactics.mjs';
const env={collide(){}};
function fixture(){return {elapsed:0,missionId:'free-roam',players:{local:{x:0,z:45,health:100,wanted:0,cash:750,lastCrime:-100}},npcs:[],cars:[],units:[],cityEvent:createCityEvent()};}
test('five event phases, one bounded population, cooldown and clean disable',()=>{
 const s=fixture();updateCityEvent(s,1/30,env);assert.equal(s.npcs.length,50);const ids=s.npcs.map(n=>n.id);
 for(const [time,phase] of [[10,'gathering'],[35,'rally'],[95,'unrest'],[140,'deescalation'],[210,'dispersal']]){
  s.elapsed=time;updateCityEvent(s,1/30,env);assert.equal(s.cityEvent.phase,phase);assert.deepEqual(s.npcs.map(n=>n.id),ids);
 }
 const bystander={id:'persistent-citizen'};s.npcs.push(bystander);s.elapsed=240;updateCityEvent(s,1/30,env);
 assert.deepEqual(s.npcs,[bystander]);assert.equal(s.cityEvent.startedAt,null);
 s.elapsed=300;updateCityEvent(s,1/30,env);assert.equal(s.npcs.length,1);
 s.elapsed=601;updateCityEvent(s,1/30,env);assert.equal(s.npcs.length,51);
 stopCityEvent(s);assert.equal(s.cityEvent.enabled,false);assert.deepEqual(s.npcs,[bystander]);assert.deepEqual(s.cityEvent.orders,{});assert.deepEqual(s.cityEvent.pyro,[]);
});
test('event does not start remotely, during missions, or when disabled',()=>{
 for(const change of [s=>s.players.local.x=500,s=>s.missionId='first-shift',s=>s.cityEvent.enabled=false]){
  const s=fixture();change(s);updateCityEvent(s,1/30,env);assert.equal(s.npcs.length,0);
 }
});
test('collision rejection cannot place crowds inside buildings or overlap originals',()=>{
 const s=fixture();s.npcs.push({id:'original',x:-7.35,z:8});updateCityEvent(s,1/30,{collide(p){if(p.x>0)p.x+=5;}});
 assert.ok(s.npcs.filter(n=>n.cityEvent).every(n=>n.x<=0));
 for(const n of s.npcs)for(const other of s.npcs)if(n!==other)assert.ok(Math.hypot(n.x-other.x,n.z-other.z)>=1.05);
});
test('orders are role-specific, acknowledged, expire, reject stale updates and move toward commanded goals',()=>{
 const s=fixture();updateCityEvent(s,1/30,env);
 assert.equal(new Set(Object.values(s.cityEvent.orders).map(o=>o.kind)).size,5);
 const officer=s.npcs.find(n=>n.eventRole==='fnsh'),old=s.cityEvent.orders.fnsh;
 const order=issueUnitOrder(s.cityEvent,'fnsh','hold-cordon',{x:12,z:10},0);
 assert.equal(acceptUnitOrder(officer,order,0),true);assert.equal(acceptUnitOrder(officer,old,0),false);
 const intent=cityEventIntent(officer,s);assert.equal(intent.goal.x,officer.eventHome.x+12);assert.equal(intent.goal.z,officer.eventHome.z+10);
 s.elapsed=13;assert.equal(cityEventIntent(officer,s).speed,0);
 assert.equal(issueUnitOrder(s.cityEvent,'bad','hold-cordon',{x:0,z:0},0),null);
 assert.equal(issueUnitOrder(s.cityEvent,'fnsh','hold-cordon',{x:NaN,z:0},0),null);
});
test('bystanders flee clashes, a minority gestures, officers do not fire, attendance has no crime or reward',()=>{
 const s=fixture();updateCityEvent(s,1/30,env);s.elapsed=95;updateCityEvent(s,1/30,env);
 const citizens=s.npcs.filter(n=>n.kind==='civilian');
 assert.ok(citizens.filter(n=>!n.agitator).every(n=>cityEventIntent(n,s).speed>2));
 assert.ok(citizens.filter(n=>n.agitator).length<citizens.length/4);
 assert.ok(s.npcs.filter(n=>n.kind==='police').every(n=>n.weapon===null&&cityEventIntent(n,s).anim!=='aim'));
 assert.equal(s.players.local.wanted,0);assert.equal(s.players.local.cash,750);
 for(let t=96;t<135;t++){s.elapsed=t;updateCityEvent(s,1,env);assert.ok(s.cityEvent.pyro.length<=3);}
});
test('incoming traffic stops, through routes divert, and vehicles inside can leave',()=>{
 const s=fixture();updateCityEvent(s,1/30,env);
 assert.ok(cityEventRoadGap({x:0,z:50,heading:0},s.cityEvent)<21);
 assert.equal(cityEventRoadGap({x:0,z:50,heading:Math.PI},s.cityEvent),Infinity);
 assert.equal(cityEventRoadGap({x:0,z:10,heading:0},s.cityEvent),Infinity);
 assert.equal(cityEventRoadBlocked({x:0,z:50},{x:0,z:-50},s.cityEvent),true);
 assert.equal(cityEventRoadBlocked({x:45,z:50},{x:45,z:-50},s.cityEvent),false);
 s.cityEvent.phase='dispersal';assert.equal(cityEventRoadGap({x:0,z:50,heading:0},s.cityEvent),Infinity);
});
test('specialist profiles change decisions instead of only changing uniforms',()=>{
 const target={x:0,z:0};
 const officer=forceCharacter=>({id:'lead',x:0,z:23,health:100,forceCharacter});
 const patrol=officer('patrol_officer'),fnsh=officer('fnsh_officer');
 assert.equal(tacticalGoal(patrol,target,[patrol],[],1,()=>true).anim,'walk');
 assert.equal(tacticalGoal(fnsh,target,[fnsh],[],1,()=>true).anim,'aim');
 assert.ok(forceBehavior(officer('shqiponja_officer')).runSpeed>forceBehavior(fnsh).runSpeed);
 for(const [role,expected] of [['traffic_officer','idle'],['renea_officer','walk']]){
  const n={...officer(role),lastSeen:{x:0,z:0},lastSeenAt:1};
  assert.equal(tacticalGoal(n,target,[n],[],11,()=>false).anim,expected);
 }
});
