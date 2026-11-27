import test from 'node:test';
import assert from 'node:assert/strict';
import { readReturnPreview, saveReturnPreview } from '../webapp/src/games/tiranastreets-november/street-career/storyReturnPreview.mjs';
import { readMissingFriendPreview, saveMissingFriendPreview, stepMissingFriendPreview } from '../webapp/src/games/tiranastreets-november/street-career/storyMissingFriendPreview.mjs';
const store=()=>{
 const data=new Map();
 return {getItem:key=>data.get(key)??null,setItem:(key,val)=>data.set(key,val)};
};
const target={x:6,z:8};
test('old return portal save is preserved and does not auto-skip into mission two',()=>{
 const storage=store(), call={stage:'call',stop:0,outcome:null}, done={stage:'complete',stop:1,outcome:'call-back'};
 for(const row of [call,done]){
  assert.ok(saveReturnPreview(storage,row));
  const prior=readReturnPreview(storage);
  assert.deepEqual(prior,row);
  assert.equal(readMissingFriendPreview(storage,prior),null);
  assert.equal(stepMissingFriendPreview(null,{type:'accept'},prior,target),null);
  const next=stepMissingFriendPreview(null,{type:'continue'},prior,target);
  assert.equal(!!next,prior.stage==='complete');
  if(next) assert.ok(saveMissingFriendPreview(storage,next));
  assert.deepEqual(readReturnPreview(storage),row);
 }
});
test('both branches require briefing, driving to the target, then deliberate inspection',()=>{
 for(const [branch,clue] of [['call-back','recording'],['read-note','postcard']]){
  const storage=store(), prior={stage:'complete',stop:1,outcome:branch};
  let state=stepMissingFriendPreview(null,{type:'continue'},prior,target);
  assert.strictEqual(stepMissingFriendPreview(state,{type:'accept'},prior,null),state);
  state=stepMissingFriendPreview(state,{type:'accept'},prior,target);
  assert.equal(state.stage,'drive');
  for(const event of [{type:'inspect'},{type:'position',x:6,z:8,driving:false},{type:'position',x:20,z:8,driving:true}]){
   assert.strictEqual(stepMissingFriendPreview(state,event,prior,target),state);
  }
  state=stepMissingFriendPreview(state,{type:'position',...target,driving:true},prior,target);
  assert.equal(state.stage,'arrival'); assert.equal(state.clue,null);
  assert.ok(saveMissingFriendPreview(storage,state));
  assert.deepEqual(readMissingFriendPreview(storage,prior),state);
  state=stepMissingFriendPreview(state,{type:'inspect'},prior,target);
  assert.equal(state.clue,clue); assert.equal(state.stage,'complete');
  assert.ok(saveMissingFriendPreview(storage,state));
  assert.deepEqual(readMissingFriendPreview(storage,prior),state);
  assert.equal(readMissingFriendPreview(storage,{...prior,outcome:branch==='read-note'?'call-back':'read-note'}),null);
  assert.strictEqual(stepMissingFriendPreview(state,{type:'inspect'},prior,target),state);
 }
});
test('malformed or unwritable v2 save never becomes an unlocked clue',()=>{
 const prior={stage:'complete',stop:1,outcome:'call-back'};
 const bad={getItem:()=>JSON.stringify({stage:'complete',branch:'call-back',clue:'postcard'}),setItem(){throw Error('denied');}};
 assert.equal(readMissingFriendPreview(bad,prior),null);
 const briefing=stepMissingFriendPreview(null,{type:'continue'},prior,target);
 assert.equal(saveMissingFriendPreview(bad,briefing),false);
 assert.equal(saveMissingFriendPreview(store(),{...briefing,clue:'postcard'}),false);
});
test('second mission waypoint connects to the first mission finish in the existing road graph', async()=>{
 const {MISSIONS,nearestNode,route}=await import('../webapp/src/games/tiranastreets-november/shared/engine.mjs');
 const points=MISSIONS.find(m=>m.id==='first-shift').stops;
 const from=points[2], to=points[0];
 const road=route(nearestNode(from.x,from.z),nearestNode(to.x,to.z));
 assert.ok(road.length>1);
 assert.ok(road.every(({x,z})=>Number.isFinite(x)&&Number.isFinite(z)));
 const prior={stage:'complete',stop:1,outcome:'read-note'};
 let state=stepMissingFriendPreview(null,{type:'continue'},prior,to);
 state=stepMissingFriendPreview(state,{type:'accept'},prior,to);
 state=stepMissingFriendPreview(state,{type:'position',...road.at(-1),driving:true},prior,to);
 assert.equal(state.stage,'arrival');
});
