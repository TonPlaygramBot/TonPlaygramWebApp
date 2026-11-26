import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ArcadeResponse} from '../webapp/src/games/tiranastreets-november/street-career/arcadeResponse.mjs';

const officer=()=>({id:'npc',kind:'police',health:100,x:0,z:0,anim:'aim',speed:1,aimSince:2});
const player=()=>({id:'local',health:100,x:1,z:0,wanted:450,weapon:'game-equipped'});

test('a held item, high heat and repeated unarmed hits do not authorize NPC weapons',()=>{
  const rule=new ArcadeResponse(),n=officer(),p=player();
  for (const now of [2, 3, 5, 6]) {
    assert.equal(rule.registerUnarmedHit(now,n),true);
    assert.equal(rule.update(now,[n],p),true);
    assert.equal(rule.allowsNpcWeapon(now),false);
    assert.equal(rule.holdOfficer(now,n),true);
    assert.equal(n.anim,'idle');
    assert.equal(n.aimSince,undefined);
  }
});
test('civilian hits never create the officer warning; an officer warning stops on retreat or times out',()=>{
  const rule=new ArcadeResponse(),n=officer(),p=player();
  assert.equal(rule.registerUnarmedHit(2,{...n,kind:'civilian'}),false);
  assert.equal(rule.update(2,[n],p),false);
  rule.registerUnarmedHit(2,n);
  assert.equal(rule.update(2,[n],p),true);
  assert.equal(rule.update(3,[n],{...p,x:8}),false);
  assert.equal(rule.update(3,[n],p),false);
  rule.registerUnarmedHit(3,n);
  assert.equal(rule.update(6,[n],p),false);
});
test('a committed weapon use may resume only the existing response and resets on calm or timeout',()=>{
  const rule=new ArcadeResponse(),n=officer(),p=player();
  rule.recordWeaponUse(10);
  assert.equal(rule.allowsNpcWeapon(10),true);
  assert.equal(rule.holdOfficer(10,n),false);
  assert.equal(rule.allowsNpcWeapon(30),false);
  rule.recordWeaponUse(31);
  rule.update(32,[n],{...p,wanted:0});
  assert.equal(rule.allowsNpcWeapon(32),false);
});
test('does not freeze actors in vehicles or repurpose non-officers',()=>{
  const rule=new ArcadeResponse(),n=officer();
  assert.equal(rule.holdOfficer(2,{...n,kind:'civilian'}),false);
  assert.equal(rule.holdOfficer(2,{...n,motion:'drive',deployed:false}),false);
});
