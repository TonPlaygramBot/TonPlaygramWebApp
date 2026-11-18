import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRacer,makeTrack,STEP,stepRace,RACING_PACE} from '../webapp/src/games/kartroyale/simulation.mjs';
import {resampleCircuit} from '../webapp/src/games/kartroyale/grandRouteCore.mjs';
import {raceItemPickups,stepRaceItems,shouldAIUseRaceItem,RACE_ITEM_RULES} from '../webapp/src/games/kartroyale/raceItems.mjs';
const track={...resampleCircuit([[0,0],[0,2000],[2000,2000],[2000,0]],720),width:20};
const make=(id='a')=>Object.assign(createRacer(track,id,id),{x:0,z:300,yaw:0,velocityYaw:0,speed:20,groundY:0,index:11});
const tick=(rs,time=5)=>stepRaceItems(rs,track,STEP,time);

test('pickup layout is bounded, deterministic, evenly includes all supplies and snapshots have no shared state',()=>{
 const a=raceItemPickups(track),b=raceItemPickups(JSON.parse(JSON.stringify(track)));
 assert.deepEqual(a,b);assert.ok(a.length<=RACE_ITEM_RULES.maxPickups);
 assert.deepEqual([...new Set(a.map(p=>p.kind))].sort(),['boost','rocket','shield']);
 const r=make(),s=make('b');r.itemCooldowns[0]=20;
 assert.equal(s.itemCooldowns[0],undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(r)).itemCooldowns,{'0':20});
});
test('swept pickup crossing collects one slot; parallel miss, full slot and cooldown cannot farm it',()=>{
 const p=raceItemPickups(track)[0],r=make();
 Object.assign(r,{x:p.x,z:p.z+4});
 stepRaceItems([r],track,STEP,5,[{x:p.x,z:p.z-4}]);
 assert.equal(r.raceItem,'rocket');assert.equal(r.itemCooldowns[p.id],17);
 r.raceItem=null;tick([r],6);assert.equal(r.raceItem,null);
 const miss=Object.assign(make('miss'),{x:p.x+5,z:p.z+4});
 stepRaceItems([miss],track,STEP,5,[{x:p.x+5,z:p.z-4}]);assert.equal(miss.raceItem,null);
 const full=Object.assign(make('full'),{x:p.x,z:p.z,raceItem:'shield'});tick([full]);assert.equal(full.raceItem,'shield');
});
test('personal supplies are fair to simultaneous side-by-side racers',()=>{
 const p=raceItemPickups(track)[1],a=Object.assign(make(),{x:p.x-.4,z:p.z}),b=Object.assign(make('b'),{x:p.x+.4,z:p.z});
 tick([a,b]);assert.equal(a.raceItem,p.kind);assert.equal(b.raceItem,p.kind);
});
test('use is rising-edge only, boost temporary, shields expire and empty presses do not invent items',()=>{
 const r=make();r.raceItem='boost';r.input.useItem=true;tick([r]);
 assert.equal(r.raceItem,null);assert.equal(r.turbo,1.8);
 r.raceItem='shield';tick([r]);assert.equal(r.raceItem,'shield');assert.equal(r.itemShield,0);
 r.input.useItem=false;tick([r]);r.input.useItem=true;tick([r]);assert.equal(r.itemShield,4);
 r.input.useItem=false;for(let i=0;i<241;i++)tick([r]);assert.equal(r.itemShield,0);
 r.input.useItem=true;tick([r]);assert.equal(r.itemRocket,null);
});
test('rocket travels visibly, hits earliest target, slows without damaging or retiring, and cannot hit owner',()=>{
 const a=make(),b=Object.assign(make('b'),{z:320}),c=Object.assign(make('c'),{z:330});
 a.raceItem='rocket';a.input.useItem=true;tick([a,b,c]);assert.ok(a.itemRocket);assert.equal(b.speed,20);
 for(let i=0;i<30;i++)tick([a,b,c]);
 assert.equal(a.itemRocket,null);assert.equal(a.speed,20);assert.ok(Math.abs(b.speed-13.6)<1e-10);assert.equal(c.speed,20);
 assert.equal(b.health,100);assert.equal(b.retired,false);assert.equal(b.progress,make('x').progress);
});
test('shield blocks a simultaneous rocket, and expired rocket is cleaned up',()=>{
 const a=make(),b=Object.assign(make('b'),{z:303});
 a.raceItem='rocket';a.input.useItem=true;b.raceItem='shield';b.input.useItem=true;
 tick([a,b]);assert.equal(b.speed,20);assert.equal(b.itemEventKind,'blocked');assert.equal(a.itemRocket,null);
 const lone=make();lone.raceItem='rocket';lone.input.useItem=true;tick([lone]);
 for(let i=0;i<110;i++)tick([lone]);assert.equal(lone.itemRocket,null);
});
test('multiple rockets do not stack speed punishment and finished/disconnected racers are excluded',()=>{
 const target=Object.assign(make('target'),{z:305}),a=Object.assign(make(),{x:-.6}),b=Object.assign(make('b'),{x:.6});
 for(const r of [a,b]){r.raceItem='rocket';r.input.useItem=true;}
 for(let i=0;i<10;i++)tick([a,b,target]);
 assert.ok(Math.abs(target.speed-13.6)<1e-10, 'simultaneous hits do not stack');
 const done=Object.assign(make('done'),{finished:true,raceItem:'shield',input:{useItem:true}});tick([done]);assert.equal(done.itemShield,0);
 const gone=Object.assign(make('gone'),{disconnected:true,itemRocket:{x:0,y:.65,z:300,vx:0,vz:52,life:1,id:1}});tick([gone]);assert.equal(gone.itemRocket,null);
});
test('AI uses acquired rockets only with a forward rival and shields only against approaching projectiles',()=>{
 const r=make(),target=Object.assign(make('target'),{z:325});r.raceItem='rocket';
 assert.equal(shouldAIUseRaceItem(r,[r,target],track,5),true);
 target.x=10;assert.equal(shouldAIUseRaceItem(r,[r,target],track,5),false);
 r.raceItem='shield';target.itemRocket={x:0,z:280,vx:0,vz:52};assert.equal(shouldAIUseRaceItem(r,[r,target],track,5),true);
 target.itemRocket.vz=-52;assert.equal(shouldAIUseRaceItem(r,[r,target],track,5),false);
});
test('fixed-step integrated race uses item input and serializable state; server accepts only boolean useItem',()=>{
 const r=make();r.raceItem='shield';r.input.useItem=true;stepRace([r],track,STEP,5);assert.equal(r.itemShield,4);
 const restored=JSON.parse(JSON.stringify(r));stepRace([restored],track,STEP,5+STEP);assert.ok(restored.itemShield<4);
 assert.deepEqual(RACING_PACE,{cruise:31,turbo:41});
 const server=readFileSync(new URL('../bot/services/kartRoyale.js',import.meta.url),'utf8');
 assert.match(server,/useItem: d\.useItem === true/);
 assert.doesNotMatch(server,/raceItem:\s*d\./);
});

test('rockets disappear at road boundaries rather than crossing buildings',()=>{
 const r=make();r.yaw=Math.PI/2;r.raceItem='rocket';r.input.useItem=true;tick([r]);
 for(let i=0;i<20;i++)tick([r]);
 assert.equal(r.itemRocket,null);
});
