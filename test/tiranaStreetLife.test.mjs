import test from 'node:test';
import {CANOPY_TREES} from '../webapp/src/games/tirana-street-life/canopyRegistry.mjs';
import assert from 'node:assert/strict';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {STREET_SOURCE} from '../webapp/src/games/tirana-street-life/streetSourceData.mjs';
import {STREET_LIFE as S,MATURE_TREE_IDS,FUEL_CANOPY_IDS} from '../webapp/src/games/tirana-street-life/registry.mjs';
import {resolveStreetFronts,resolveStops} from '../webapp/src/games/tirana-street-life/streetLifeCore.mjs';
import {buildStreetModel,nearbyIndex} from '../webapp/src/games/tirana-street-life/streetModels.mjs';
import {fuelCanopyObstacles} from '../webapp/src/games/tirana-street-life/fuelCollision.mjs';
import {MAPPED_TREES,INSTITUTION_BUILDING_IDS} from '../webapp/src/games/tirana-city-source/registry.mjs';
import {containsPoint} from '../webapp/src/games/tirana-landmarks/nativeLocations.mjs';
import {segmentDistance} from '../webapp/src/games/tirana-city-source/sourceCore.mjs';
import {STREET_PROPS,STREET_SOLIDS,collideStreetProps} from '../webapp/src/games/tiranastreets/shared/streetDressing.mjs';
import {collides} from '../webapp/src/games/blackwater/shared/physics.mjs';
import {ORIGIN,OBSTACLES} from '../webapp/src/games/blackwater/shared/layout.mjs';

test('348 traceable ground-floor assignments retain source names and footprint identity',()=>{
 assert.equal(S.storefronts.length,348);const source=new Map(STREET_SOURCE.places.map(s=>[s.id,s]));
 for(const f of S.storefronts){
  assert.equal(f.name,source.get(f.id).tags.name||source.get(f.id).tags.brand);
  assert.deepEqual(f.point,source.get(f.id).p);assert.ok(WORLD.buildings.some(b=>b.id===f.buildingId));
  assert.ok(!INSTITUTION_BUILDING_IDS.has(f.buildingId));assert.ok(!/sky club|aba 21|rooftop/i.test(f.name));
  assert.ok(!WORLD.buildings.filter(b=>b.id===f.buildingId).some(b=>containsPoint(f.x,f.z,b.p)));
 }
});
const fixture={origin:[0,0],bounds:[-100,-100,100,100],roads:[{a:[-50,-6],b:[50,-6],w:4,name:'Bulevardi fixture',walk:false}],buildings:[{id:'1',p:[[-8,0],[8,0],[8,10],[-8,10]],h:10}]};
const place=(id,p,tags={})=>({id,p,category:'cafe',tags:{name:'Fixture cafe',...tags}});
test('frontage matching rejects upstairs, ambiguous, distant and overlapping tenants',()=>{
 const source={places:[place('node/1',[0,.1]),place('node/2',[0,.1]),place('node/3',[5,2],{level:'2'}),place('node/4',[50,50])]};
 const copy=structuredClone(fixture),r=resolveStreetFronts(fixture,source);assert.equal(r.fronts.length,1);assert.equal(r.issues.length,3);assert.deepEqual(fixture,copy);
 const ambiguous={...fixture,buildings:[...fixture.buildings,{...fixture.buildings[0],id:'2'}]};assert.equal(resolveStreetFronts(ambiguous,{places:[place('node/1',[0,2])]}).fronts.length,0);
 assert.equal(resolveStreetFronts(fixture,source,new Set(['1'])).fronts.length,0);
});
test('44 bus source IDs remain separate; shelters require an explicit tag and room',()=>{
 assert.equal(S.stops.length,44);assert.equal(new Set(S.stops.map(s=>s.id)).size,44);assert.equal(S.stops.filter(s=>s.shelter).length,29);
 for(const s of S.stops){const raw=STREET_SOURCE.stops.find(p=>p.id===s.id);assert.deepEqual(s.point,raw.p);if(s.shelter)assert.equal(raw.tags.shelter,'yes');}
 assert.ok(S.stops.filter(s=>s.name==='Libri Universitar').length===2);
 assert.equal(resolveStops(fixture,{stops:[place('node/0',[0,-6])]}).length,0,'lane centre cannot determine the stop side');
 assert.equal(STREET_PROPS.filter(p=>p.name==='bus_shelter').length,0,'old inferred stops retired');
 const stop=S.stops.find(s=>s.shelter),c=Math.cos(stop.yaw),v=Math.sin(stop.yaw),at=(x,z)=>({x:stop.x+x*c+z*v,z:stop.z-x*v+z*c});
 const front=at(.7,.55),back=at(.7,-1.24),before={...front};assert.equal(collideStreetProps(front,.14),false);assert.deepEqual(front,before);assert.ok(collideStreetProps(back,.14));
 assert.ok(STREET_SOLIDS.some(s=>s.sourceId===stop.id));
});
test('mapped tall trees cover both boulevard verges and square gardens without duplicate trunks',()=>{
 assert.equal(S.trees.length,929);assert.equal(MATURE_TREE_IDS.size,CANOPY_TREES.length);assert.ok(MAPPED_TREES.every(t=>MATURE_TREE_IDS.has(t.id)));const raw=new Map(MAPPED_TREES.map(t=>[t.id,t]));
 for(const t of S.trees){assert.equal(t.x,raw.get(t.id).x);assert.equal(t.z,raw.get(t.id).z);assert.ok(t.height>=5&&t.height<=30);assert.ok(t.crown>0&&t.crown<15);assert.ok(t.dimensionsAccuracy);}
 const boulevard=S.trees.filter(t=>t.zone==='boulevard');assert.equal(boulevard.length,156);
 for(const sign of [-1,1])assert.ok(boulevard.filter(t=>sign*(t.x-(.208*t.z-12.3))>5).length>30);
 assert.ok(boulevard.some(t=>t.shape==='upright'&&t.height>=20));assert.ok(boulevard.some(t=>t.shape==='umbrella'));
 assert.ok(S.trees.some(t=>t.zone==='square-gardens'&&t.x>120&&t.z<0));assert.ok(S.trees.some(t=>t.zone==='square-gardens'&&t.x>0&&t.z>0));
 for(const t of S.trees)assert.ok(!WORLD.roads.some(r=>!r.walk&&segmentDistance(t.x,t.z,r.a,r.b)<r.w/2+.24));
});
test('fuel roof outlines become open canopies with solid pumps and translated supports',()=>{
 assert.equal(S.fuel.length,5);assert.equal(FUEL_CANOPY_IDS.size,2);
 const original=fuelCanopyObstacles(),translated=fuelCanopyObstacles(ORIGIN);
 for(let i=0;i<original.length;i++){assert.ok(Math.abs(original[i].x-ORIGIN.x-translated[i].x)<1e-8);assert.ok(Math.abs(original[i].z-ORIGIN.z-translated[i].z)<1e-8);assert.equal(original[i].rot,translated[i].rot);}
 for(const f of S.fuel.filter(f=>f.canopy)){
  assert.equal(collides(f.x-ORIGIN.x,f.z-ORIGIN.z,.2,OBSTACLES),false,'walk under the canopy centre');
  const post=translated.find(p=>p.id.startsWith(f.id)&&p.w===.25);assert.equal(collides(post.x,post.z,.2,OBSTACLES),true);
  const roof=original.find(p=>p.id.startsWith(f.id)&&p.minY>4);assert.ok(roof);assert.ok(!OBSTACLES.some(o=>o.id===f.id.slice(4)));
 }
});
test('all street models fit the batched instance budget and contain no invented timetable/price',()=>{
 let max=0;const signs=new Set();
 for(const [key,type] of [['storefronts','storefront'],['stops','stop'],['fuel','fuel'],['advertising','advertising']])for(const s of S[key]){
  const model=buildStreetModel(s,type);max=Math.max(max,model.parts.length);assert.ok(model.parts.length<=70);assert.ok(model.signs.length<=4);model.signs.forEach(s=>signs.add(JSON.stringify([s.text,s.bg,s.fg])));
  for(const p of model.parts){assert.ok([...p.p,...p.s].every(Number.isFinite));assert.ok(p.s.every(s=>s>0));}
  for(const label of model.signs)assert.ok(label.text===s.name||label.text==='BUS');
 }
 assert.ok(max>30);assert.ok(Math.ceil(signs.size/8)*48<=4096);assert.equal(S.advertising.length,24);assert.ok(S.advertising.every(a=>a.id.startsWith('authored-')&&a.placementAccuracy.includes('authored')));
});
test('proximity culling is deterministic and never starves a nearby later source',()=>{
 const rows=Array.from({length:100},(_,i)=>({id:i,x:i*10,z:0})),query=nearbyIndex(rows);
 assert.deepEqual(query({x:990,z:0},50,3).map(s=>s.id),[99,98,97]);assert.equal(query({x:0,z:900},50,3).length,0);
});
