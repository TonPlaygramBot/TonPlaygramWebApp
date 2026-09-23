import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,makeTrack,createRacer,stepRacer,STEP} from '../webapp/src/games/kartroyale/simulation.mjs';
import {WORLD as CITY} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {WORLD} from '../webapp/src/games/kartroyale/racingWorld.mjs';
import {RURAL_WORLD} from '../webapp/src/games/kartroyale/ruralWorldData.mjs';
import {RURAL_ROUTES} from '../webapp/src/games/kartroyale/rural-routes.mjs';
import {FREE_ROAM_STARTS,freeRoamWorld} from '../webapp/src/games/kartroyale/freeRoam.mjs';
import {createCityJob} from '../webapp/src/games/kartroyale/cityJobs.mjs';
import {buildRaceCatalog} from '../webapp/src/games/kartroyale/raceCatalog.mjs';
const key=(a,b)=>[a.join(','),b.join(',')].sort().join('|');

test('all nine selectable tracks construct after the shared city crop',()=>{
 assert.equal(TRACKS.length,9);
 for(const config of TRACKS){
  const track=makeTrack(config.id);assert.equal(track.id,config.id);
  assert.ok(track.length>0&&track.points.length>=360);
  assert.ok(track.points.every(p=>[p.x,p.z,p.width].every(Number.isFinite)));
  assert.equal(makeTrack(config.id),track,'reuse the prepared circuit');
 }
});
test('Racing restores exact rural road segments without modifying the urban world',()=>{
 assert.deepEqual(CITY.bounds,[-5000,-3500,3600,3100]);
 const cityEdges=new Set(CITY.roads.map(r=>key(r.a,r.b))),roads=new Map(WORLD.roads.map(r=>[key(r.a,r.b),r]));
 let restored=0;
 for(const route of RURAL_ROUTES)for(let i=0;i<route.points.length;i++){
  const edge=key(route.points[i],route.points[(i+1)%route.points.length]);
  assert.ok(roads.get(edge)?.w>0,`${route.id} keeps its sourced segment ${i}`);
  if(!cityEdges.has(edge))restored++;
 }
 assert.equal(restored,333);assert.notEqual(WORLD.roads,CITY.roads);
 assert.ok(WORLD.bounds[2]>7254&&CITY.bounds[2]===3600);
 assert.equal(RURAL_WORLD.regions.length,2);
});
test('every free-roam start and Farkë handover stays inside Racing bounds with a nearby recovery road',()=>{
 const world=freeRoamWorld();
 const probes=FREE_ROAM_STARTS.map(s=>({track:makeTrack(s.track),point:makeTrack(s.track).points[0]}));
 const track=makeTrack('farke');
 probes.push(...createCityJob('farke-supplies',track).targets.map(point=>({track,point})));
 for(const {track,point:p} of probes){
  const r=createRacer(track,'you','You');Object.assign(r,{x:p.x,z:p.z,yaw:p.yaw,velocityYaw:p.yaw});
  stepRacer(r,{},track,STEP,STEP,'street',world);
  assert.ok(Math.hypot(r.x-p.x,r.z-p.z)<.1,`${track.id}: start/stop must not teleport to the urban cutoff`);
  assert.ok(world.nearestRoad(p.x,p.z)?.distance<2,`${track.id}: retained recovery road`);
 }
});
test('a genuinely unsourced circuit still fails validation instead of receiving an invented width',()=>{
 const legacy={TRACKS:[{id:'bad'}],CUPS:[]};
 assert.throws(()=>buildRaceCatalog(legacy,[{id:'bad',points:[[99999,99999],[99999,99990],[99990,99999]]}]),/street network \(bad, segment 0\)/);
});
