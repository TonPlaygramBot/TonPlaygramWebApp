import test from 'node:test';
import assert from 'node:assert/strict';
import {URBAN_RACE_ROUTES} from '../webapp/src/games/kartroyale/urban-race-routes.mjs';
import {TRACKS,makeTrack,normalizeTrack,CUPS,TRACK_ALIASES,createRacer,nearestPoint,stepRace,STEP} from '../webapp/src/games/kartroyale/simulation.mjs';
import {MAIN_ROAD_ROUTES} from '../webapp/src/games/kartroyale/main-road-routes.mjs';
import {WORLD} from '../webapp/src/games/kartroyale/racingWorld.mjs';
import {buildingClearance,courseRoadSurface} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {circuitSides} from '../webapp/src/games/kartroyale/trackEdges.mjs';
const key=(a,b)=>[a.join(','),b.join(',')].sort().join('|');
const roads=new Map(WORLD.roads.map(r=>[key(r.a,r.b),r]));

test('only twenty new sourced city cycles are selectable',()=>{
 assert.equal(URBAN_RACE_ROUTES.length,20);assert.equal(TRACKS.length,20);
 const signatures=new Set();
 for(const route of TRACKS){
  const edges=route.points.map((p,i)=>key(p,route.points[(i+1)%route.points.length]));
  assert.equal(new Set(route.points.map(p=>p.join(','))).size,route.points.length,route.id+' repeated junction');
  const signature=edges.sort().join(';');assert.ok(!signatures.has(signature),route.id+' reversed/rotated clone');signatures.add(signature);
  for(const edge of edges)assert.ok(roads.has(edge)&&!roads.get(edge).walk,route.id+' unsourced road');
 }
 for(const id of ['farke','surrel','liqeni',...MAIN_ROAD_ROUTES.map(t=>t.id)])assert.ok(!TRACKS.some(t=>t.id===id));
});

test('new routes are not tiny shortcuts or overlapping variants of retained routes',()=>{
 const compared=[...MAIN_ROAD_ROUTES,...TRACKS];
 const sets=compared.map(route=>new Map(route.points.map((p,i)=>{const q=route.points[(i+1)%route.points.length];return [key(p,q),Math.hypot(q[0]-p[0],q[1]-p[1])];})));
 for(let i=6;i<sets.length;i++)for(let j=0;j<i;j++){
  const a=sets[i],b=sets[j],shared=[...a].reduce((sum,[k,length])=>sum+(b.has(k)?length:0),0);
  const length=x=>[...x.values()].reduce((a,b)=>a+b,0);
  assert.ok(shared/Math.min(length(a),length(b))<=.7,compared[i].id+' substantially repeats '+compared[j].id);
 }
});

test('new road ribbons retain actual asphalt and building clearance, with collision-free twelve-kart grids',()=>{
 for(const route of URBAN_RACE_ROUTES){
  const track=makeTrack(route.id),surface=courseRoadSurface(route.points,route.points.map((p,i)=>roads.get(key(p,route.points[(i+1)%route.points.length])).w));
  assert.equal(track.passingAudit.unresolved.length,0,route.id);
  assert.ok(track.startGrid.turn<.15,route.id+' bent grid');
  const sides=circuitSides(track.points,track.width/2);
  for(const p of track.points){assert.ok(p.width>=4.8-1e-6,route.id+' bottleneck');assert.ok(buildingClearance(p.x,p.z)>p.width/2+1,route.id+' building');}
  for(const side of ['left','right'])for(let i=0;i<sides[side].length;i++){
   const p=sides[side][i],q=sides[side][(i+1)%sides[side].length];
   for(const t of [0,.25,.5,.75])assert.ok(surface.contains(p.x+(q.x-p.x)*t,p.z+(q.z-p.z)*t),route.id+' paved outside source road');
  }
  const racers=Array.from({length:12},(_,i)=>createRacer(track,'grid'+i,'Driver',i,true));
  for(const r of racers){const near=nearestPoint(track,r.x,r.z,r.index);assert.ok(near.distance+r.bodyWidth/2+.4<near.width/2,route.id+' grid boundary');for(const q of racers)if(q!==r)assert.ok(Math.hypot(q.x-r.x,q.z-r.z)>2,route.id+' grid overlap');}
 }
});

for(const route of URBAN_RACE_ROUTES)test(route.id+' AI completes the actual three-lap route',()=>{
 const track=makeTrack(route.id),r=createRacer(track,'ai','AI',0,true);
 for(let time=STEP;time<1000&&!r.finished;time+=STEP){stepRace([r],track,STEP,time,'pro');assert.ok([r.x,r.z,r.speed].every(Number.isFinite));const near=nearestPoint(track,r.x,r.z,r.index);assert.ok(near.distance+r.bodyWidth/2<=near.width/2+.05,route.id+' AI body leaves corridor');}
 assert.ok(r.finished,route.id+' AI did not finish');assert.equal(r.telemetry.completed,3);
});

test('twelve-rival packs finish all twenty courses without nonfinite state or blocked grids',()=>{
 for(const route of URBAN_RACE_ROUTES){
  const track=makeTrack(route.id),racers=Array.from({length:12},(_,i)=>createRacer(track,'ai'+i,'AI',i,true));
  for(let time=STEP;time<1000&&!racers.every(r=>r.finished);time+=STEP)stepRace(racers,track,STEP,time,'pro');
  assert.ok(racers.every(r=>r.finished),route.id+' pack stalled: '+racers.filter(r=>!r.finished).map(r=>r.id));
  assert.ok(racers.every(r=>[r.x,r.z,r.speed].every(Number.isFinite)),route.id);
 }
});

test('all historical IDs, defaults and cup entries resolve to selectable new geometry',()=>{
 for(const [old,id] of Object.entries(TRACK_ALIASES)){
  assert.equal(normalizeTrack(old),id);assert.equal(normalizeTrack(id),id);
  assert.equal(makeTrack(old),makeTrack(id));assert.ok(TRACKS.some(t=>t.id===id));
 }
 assert.equal(makeTrack().id,TRACKS[0].id);
 for(const cup of CUPS)assert.ok(TRACKS.some(t=>t.id===cup.track));
 assert.throws(()=>makeTrack('made-up-course'),/unavailable/);
});
