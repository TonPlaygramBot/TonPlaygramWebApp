import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ambientGlance,ambientIdlePhase,plainCivilianIdle} from '../webapp/src/games/tiranastreets-november/street-career/ambientIdle.mjs';

const stopped={id:'citizen-1',kind:'civilian',health:100,motion:'walk',anim:'idle'};

test('ambient idle offsets and glances are deterministic, varied, brief and bounded',()=>{
 const seeds=[0x121119ef,0xabcdef89,0xf00000af,0x12abadaa];
 for(const seed of seeds){
  assert.ok(ambientIdlePhase(seed)>=0&&ambientIdlePhase(seed)<1);
  const sample=Array.from({length:800},(_,i)=>ambientGlance(seed,i/100));
  assert.deepEqual(sample,Array.from({length:800},(_,i)=>ambientGlance(seed,i/100)));
  const active=sample.filter(v=>Math.abs(v)>.01);
  assert.ok(active.length>0&&active.length<sample.length*.45);
  assert.ok(sample.every((v,i)=>Math.abs(v)<=.2 && (!i || Math.abs(v-sample[i-1])<.005)));
 }
 assert.notDeepEqual(seeds.map(k=>ambientGlance(k,.9)),[0,0,0,0]);
 assert.equal(new Set(seeds.map(ambientIdlePhase)).size,seeds.length);
 assert.equal(ambientGlance(1,NaN),0);
});

test('the ambient layer never owns cyclists, vehicles, armed or action poses',()=>{
 assert.equal(plainCivilianIdle(stopped),true);
 assert.equal(plainCivilianIdle({...stopped,anim:'walk'}),true);
 for(const change of [{kind:'police'},{health:0},{motion:'cycle'},{motion:'drive'},
   {weapon:'held'},{anim:'reload'},{anim:'run'},{anim:'chant'},{anim:'hit'}]){
  assert.equal(plainCivilianIdle({...stopped,...change}),false);
 }
});
