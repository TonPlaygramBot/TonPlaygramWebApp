import assert from 'node:assert/strict';
import test from 'node:test';
import {createStoryAmbientPreview,STORY_AMBIENT_LIMITS as L} from '../webapp/src/games/tiranastreets-november/street-career/storyAmbientPreview.mjs';

const anchors=Object.freeze([
  Object.freeze({id:'day-a',kind:'roadside',x:35,z:0}),
  Object.freeze({id:'day-b',kind:'roadside',x:-35,z:0}),
  Object.freeze({id:'night-a',kind:'safeReturn',x:35,z:0})
]);
const context=(overrides={})=>({
  enabled:true,ready:true,solo:true,freeRoam:true,missionActive:false,restricted:false,paused:false,
  phase:'day',player:{x:0,z:0,health:100,onFoot:true},anchors,...overrides
});
const at=(x,z=0,onFoot=true)=>({x,z,health:100,onFoot});
const create=()=>createStoryAmbientPreview({isAccessible:a=>anchors.some(p=>p.id===a.id)});
function run(story,c,seconds) {
  let offer=null;
  for(let n=0;n<Math.round(seconds*20);n++)offer=story.step(c,.05);
  return offer;
}
const first=(story,c=context())=>run(story,c,L.firstOffer+.1);

test('requires explicit opt-in, safe placement and an eligible city session',()=>{
  for(const diff of [{enabled:false},{ready:false},{solo:false},{freeRoam:false},{missionActive:true},{restricted:true},{paused:true},{player:{x:0,z:0,health:0}}])
    assert.equal(first(create(),context(diff)),null);
  assert.equal(first(createStoryAmbientPreview()),null);
  assert.equal(first(create()).kind,'roadside');
});
test('different explicit phases yield the right fictional previews; unknown lighting fails closed',()=>{
  assert.equal(first(create(),context({phase:'night'})).kind,'safeReturn');
  assert.equal(first(create(),context({phase:null})),null);
});
test('distance bounds, nearest anchor and deterministic tie break',()=>{
  assert.equal(first(create(),context({player:at(999)})),null);
  assert.equal(first(create(),context({anchors:[anchors[0]],player:at(30)})),null);
  assert.equal(first(create(),context({anchors:[...anchors].reverse()})).x,35);
  assert.equal(first(create(),context({player:at(-5)})).x,-35);
  const story=create(),offer=first(story);
  assert.ok(Object.isFrozen(offer));
  assert.equal(story.step(context({player:at(1000)}),.05),null);
});
test('ignore or expiry imposes cooldown; paused wall clock does not time out accepted work',()=>{
  const c=context(),story=create(),offer=first(story,c);
  assert.deepEqual(story.act(c,{id:offer.id,action:'ignore'}),{id:offer.id,status:'dismissed'});
  assert.equal(run(story,c,L.cooldown-1),null);
  const next=run(story,c,1.1);assert.ok(next);
  assert.notEqual(next.id,offer.id);
  story.act(c,{id:next.id,action:'accept'});
  assert.equal(run(story,context({paused:true}),L.acceptedLife+5),null);
  assert.equal(story.step(c,.05).status,'accepted');
  assert.equal(run(story,c,L.acceptedLife+.1),null);
});
test('a mission or restricted gameplay cancels active preview, with no stale completion',()=>{
  for(const block of [{missionActive:true},{freeRoam:false},{restricted:true},{enabled:false}]){
    const c=context(),story=create(),offer=first(story,c);
    story.act(c,{id:offer.id,action:'accept'});
    assert.equal(story.step(context(block),.1),null);
    assert.equal(story.act(context({player:at(35)}),{id:offer.id,action:'resolve'}),null);
    assert.equal(run(story,c,L.cooldown-1),null);
  }
});
test('requires explicit acceptance and near on-foot confirmation and changes no caller state',()=>{
  const c=context(),story=create(),snapshot=structuredClone(c);
  const {id}=first(story,c);
  assert.equal(story.act(context({player:at(35)}),{id,action:'resolve'}),null);
  assert.equal(story.act(c,{id:'old',action:'accept'}),null);
  assert.equal(story.act(c,{id,action:'accept'}).status,'accepted');
  assert.equal(story.act(c,{id,action:'resolve'}),null);
  assert.equal(story.act(context({player:at(35,0,false)}),{id,action:'resolve'}),null);
  assert.equal(story.act(context({player:at(35)}),{id,action:'resolve'}).status,'resolved');
  assert.equal(story.act(context({player:at(35)}),{id,action:'resolve'}),null);
  assert.deepEqual(c,snapshot);
});
test('an unloaded or invalidated anchor cannot offer or complete a preview',()=>{
  let available=false;
  const story=createStoryAmbientPreview({isAccessible:a=>{
    if(!available)throw Error('fixture chunk unavailable');
    return a.id===anchors[0].id;
  }});
  const c=context();
  assert.equal(first(story,c),null);
  available=true;
  const offer=run(story,c,.6);
  assert.equal(story.act(c,{id:offer.id,action:'accept'}).status,'accepted');
  available=false;
  assert.equal(story.act(context({player:at(35)}),{id:offer.id,action:'resolve'}),null);
  assert.equal(story.step(c,.05),null);
});
test('crossing the day/night boundary hides prior offers instead of changing the offer type in place',()=>{
  const story=create(),day=context(),offer=first(story,day);
  const night=context({phase:'night'});
  assert.equal(story.step(night,.1),null);
  assert.equal(story.act(night,{id:offer.id,action:'accept'}),null);
  assert.equal(run(story,night,L.cooldown-1),null);
  assert.equal(run(story,night,1.2).kind,'safeReturn');
});
