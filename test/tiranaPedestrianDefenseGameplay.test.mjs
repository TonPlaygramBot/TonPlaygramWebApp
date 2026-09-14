import test from 'node:test';
import assert from 'node:assert/strict';
import {harm,updateCityLife} from '../webapp/src/games/tiranastreets/shared/cityLife.mjs';

function fixture(role='adult',motion='walk'){
  const p={id:'player',x:0,z:0,heading:0,speed:0,health:100,armor:0,weapon:'',inventory:{},lastDamage:-10,lastCrime:0,wanted:0,inputAt:-10,input:{}};
  const n={id:'citizen-1',kind:'civilian',role,motion,x:0,z:-1.2,heading:0,speed:0,health:100,weapon:'',downUntil:0,panicUntil:0,path:[{x:0,z:-1.2},{x:0,z:-12}],pathIndex:1};
  const state={elapsed:0,difficulty:'normal',missionId:'free-roam',players:{player:p},npcs:[n],cars:[],traffic:[],units:[],policeVersion:1,dispatchQueue:{},effects:[],effectSeq:0};
  const env={world:{roads:[],graph:{nodes:[],edges:[]}},clear:()=>true,collide(){},along(actor,goal,speed,dt){actor.speed=speed;actor.z+=Math.sign(goal.z-actor.z)*speed*dt;}};
  const step=time=>{state.elapsed=time;updateCityLife(state,1/60,env,{type:'free-roam'});};
  return {state,p,n,env,step};
}

test('actual shared harm and NPC update produce a visible timed counter only after an unarmed melee hit',()=>{
  const {state,p,n,env,step}=fixture();
  step(0);assert.equal(p.health,100);assert.notEqual(n.anim,'fight');
  harm(state,n,16,p,env);assert.equal(n.health,84);
  step(.1);assert.equal(n.anim,'fight');assert.equal(p.health,100,'readable windup before contact');
  step(.31);assert.equal(p.health,94);assert.equal(n.punchedAt,.31);
  const contacts=state.effects.filter(e=>e.kind==='hit'&&e.owner===n.id);
  assert.equal(contacts.length,1,'counter uses the normal damage/effect system');
  step(.5);assert.equal(p.health,94,'no damage every animation frame');
  p.weapon='ak47VolleyAttack';step(1.3);assert.equal(p.health,94);assert.notEqual(n.anim,'fight');assert.equal(n.defenseAttackerId,null);
});

test('actual civilian update keeps children and cyclists fleeing and ends defense when the attacker withdraws',()=>{
  for(const [role,motion] of [['child','walk'],['adult','cycle']]){
    const {state,p,n,env,step}=fixture(role,motion);harm(state,n,16,p,env);step(.4);
    assert.equal(p.health,100);assert.notEqual(n.anim,'fight');assert.ok(n.speed>0,'vulnerable pedestrian moves away');
  }
  const {state,p,n,env,step}=fixture();harm(state,n,16,p,env);step(.1);p.z=8;step(.4);
  assert.equal(p.health,100);assert.notEqual(n.anim,'fight');assert.equal(n.defenseAttackerId,null);
});
