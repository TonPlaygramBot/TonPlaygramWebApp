import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from '../webapp/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../webapp/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import {MAIN_ROAD_ROUTES} from '../webapp/src/games/kartroyale/main-road-routes.mjs';
import {WORLD} from '../webapp/src/games/kartroyale/racingWorld.mjs';
import {TRACKS,KARTS,makeTrack,createRacer,equipKart,stepRace,STEP,RACE_LIMIT} from '../webapp/src/games/kartroyale/simulation.mjs';
import {courseRoadSurface,buildingClearance} from '../webapp/src/games/kartroyale/raceCourse.mjs';
import {circuitSides} from '../webapp/src/games/kartroyale/trackEdges.mjs';
import {normaliseVehicleDimensions} from '../webapp/src/games/kartroyale/vehicleAssetConfig.mjs';
import {KART_LENGTH,DRIVER_HEIGHT,kartBodyWidth} from '../webapp/src/games/kartroyale/racingDimensions.mjs';

const key=(a,b)=>[a.join(','),b.join(',')].sort().join('|');
const roads=new Map(WORLD.roads.map(r=>[key(r.a,r.b),r]));

test('city races retain their save IDs while using only connected main carriageways',()=>{
  assert.deepEqual(MAIN_ROAD_ROUTES.map(r=>r.id),['skanderbeg','blloku','lana','pyramid','stadium','lana-pyramid-grand']);
  for(const route of MAIN_ROAD_ROUTES){
    assert.equal(new Set(route.points.map(p=>p.join(','))).size,route.points.length,route.id+' duplicate junction');
    route.points.forEach((p,i)=>{
      const r=roads.get(key(p,route.points[(i+1)%route.points.length]));
      assert.ok(r&&!r.walk&&r.w>=6.2,route.id+' side street or invented connection');
    });
    const config=TRACKS.find(t=>t.id===route.id);
    assert.equal(config.routeClass,'main-roads');
    assert.deepEqual(config.points,route.points);
  }
  assert.ok(TRACKS.some(t=>t.terrainMode),'optional rural circuits remain');
});

test('rounded main-road surfaces have room for two real karts and remain inside mapped asphalt',()=>{
  for(const route of MAIN_ROAD_ROUTES){
    const config=TRACKS.find(t=>t.id===route.id),track=makeTrack(route.id);
    const surface=courseRoadSurface(config.points,config.widths);
    assert.equal(track.mapVersion,'tirana-main-roads-v3');
    assert.equal(track.passingAudit.widenedSamples,0,'do not invent asphalt shoulders');
    assert.equal(track.passingAudit.unresolved.length,0);
    assert.ok(track.points.every(p=>p.width>=4.8));
    const sides=circuitSides(track.points,track.width/2);
    for(const side of Object.values(sides))for(let i=0;i<side.length;i++){
      const a=side[i],b=side[(i+1)%side.length];
      for(const t of [0,.25,.5,.75]){
        const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
        assert.ok(surface.contains(x,z),route.id+' rendered edge left the road');
        assert.ok(buildingClearance(x,z)>1.5,route.id+' building collision');
      }
    }
  }
});

test('all fitted GLB widths agree with shared collision and AI footprints',async()=>{
  assert.equal(DRIVER_HEIGHT,1.76);
  for(const kart of KARTS){
    const b=readFileSync(new URL(`../webapp/public/assets/kart-royale/karts/${kart.id}.glb`,import.meta.url));
    const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.length),'');
    const bounds=new T.Box3().setFromObject(scene),fit=normaliseVehicleDimensions({min:bounds.min.toArray(),max:bounds.max.toArray()});
    scene.scale.setScalar(fit.scale);scene.position.set(...fit.offset);
    const size=new T.Box3().setFromObject(scene).getSize(new T.Vector3());
    const racer=equipKart(createRacer(makeTrack(),'you','You'),kart.id);
    assert.ok(Math.abs(size.z-KART_LENGTH)<1e-6);
    assert.ok(racer.bodyWidth>=size.x&&racer.bodyWidth-size.x<.011,kart.id+' footprint misses visible tyres');
    assert.equal(racer.bodyWidth,kartBodyWidth(kart.id));
  }
});

for(const {id} of MAIN_ROAD_ROUTES)test(id+': AI can finish three laps with the full kart footprint',()=>{
  const track=makeTrack(id),r=equipKart(createRacer(track,'ai','AI',0,true),'aegis');
  let time=0;
  for(;time<RACE_LIMIT&&!r.finished&&!r.retired;time+=STEP)stepRace([r],track,STEP,time,'street');
  assert.ok(r.finished,JSON.stringify({id,time,lap:r.lap,index:r.index,health:r.health}));
  assert.equal(r.gates,13);
});
