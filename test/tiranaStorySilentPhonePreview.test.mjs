import test from 'node:test';
import assert from 'node:assert/strict';
import {readSilentPhonePreview as read,saveSilentPhonePreview as save,stepSilentPhonePreview as step} from '../webapp/src/games/tiranastreets-november/street-career/storySilentPhonePreview.mjs';
const runtime=new URL('../webapp/src/games/tiranastreets-november/street-career/',import.meta.url);
const storage=()=>{
 const bytes=new Map([['tpg:story-preview:ch01-missing-friend:v2','sentinel']]);
 return {getItem:k=>bytes.get(k)??null,setItem:(k,v)=>bytes.set(k,v)};
};
const target={x:18,z:30};
test('requires prior completed mission; start is explicit and cannot overwrite v2',()=>{
 const s=storage();
 for(const stage of ['briefing','travel','arrival'])assert.equal(step(null,{type:'continue'},{stage,clue:'postcard'},target),null);
 const prior={stage:'complete',clue:'postcard'};
 assert.equal(read(s,prior),null);
 assert.equal(step(null,{type:'accept'},prior,target),null);
 assert.ok(save(s,step(null,{type:'continue'},prior,target)));
 assert.equal(s.getItem('tpg:story-preview:ch01-missing-friend:v2'),'sentinel');
});
test('reaching waypoint on the ground and branch-specific puzzle unlocks ending; wrong answer does not',()=>{
 for(const [clue,order] of [['recording','time-place'],['postcard','place-time']]){
  const prior={stage:'complete',clue};
  let p=step(null,{type:'continue'},prior,target);
  assert.strictEqual(step(p,{type:'accept'},prior,null),p);
  p=step(p,{type:'accept'},prior,target);
  for(const event of [{type:'position',...target,grounded:false,flying:false},{type:'position',...target,grounded:true,flying:true},{type:'position',x:50,z:1,grounded:true,flying:false},{type:'match',order}]){
   assert.strictEqual(step(p,event,prior,target),p);
  }
  p=step(p,{type:'position',...target,grounded:true,flying:false},prior,target);
  assert.equal(p.stage,'review');
  const wrong=order==='time-place'?'place-time':'time-place';
  assert.strictEqual(step(p,{type:'match',order:wrong},prior,target),p);
  p=step(p,{type:'match',order},prior,target);
  assert.equal(p.evidence,'shared-meeting');
  const s=storage();assert.ok(save(s,p));assert.deepEqual(read(s,prior),p);
  assert.equal(read(s,{...prior,clue:clue==='postcard'?'recording':'postcard'}),null);
 }
});
test('corrupt or denied storage cannot claim a saved outcome',()=>{
 const prior={stage:'complete',clue:'recording'}, denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 assert.equal(read(denied,prior),null);
 assert.equal(save(denied,{stage:'complete',clue:'recording',evidence:'shared-meeting'}),false);
 assert.equal(read({getItem:()=>JSON.stringify({stage:'review',clue:'recording',evidence:'shared-meeting'})},prior),null);
});
test('third waypoint uses a connected street route after the prior waypoint',async()=>{
 const {MISSIONS,nearestNode,route}=await import(new URL('../shared/engine.mjs',runtime));
 const stops=MISSIONS.find(m=>m.id==='first-shift').stops;
 const [from,to]=stops;
 const road=route(nearestNode(from.x,from.z),nearestNode(to.x,to.z));
 assert.ok(road.length>1);
 const prior={stage:'complete',clue:'postcard'};
 let p=step(null,{type:'continue'},prior,to);
 p=step(p,{type:'accept'},prior,to);
 p=step(p,{type:'position',...road.at(-1),grounded:true,flying:false},prior,to);
 assert.equal(p.stage,'review');
});
