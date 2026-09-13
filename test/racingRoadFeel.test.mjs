import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { WORLD } from '../webapp/src/games/tiranastreets/shared/world.mjs';
import { DISTRICT_ROUTES } from '../webapp/src/games/kartroyale/district-routes.mjs';
import { TRACKS, STEP, makeTrack, createRacer, stepRacer, stepRace, aiInput } from '../webapp/src/games/kartroyale/simulation.mjs';
import { buildingClearance } from '../webapp/src/games/kartroyale/raceCourse.mjs';
import { roadBumps, roadHeight, stepSuspension, ROAD_SURFACE_Y, TYRE_RADIUS, TYRE_EDGE_OFFSET } from '../webapp/src/games/kartroyale/roadFeel.mjs';
import { resolveKartContact } from '../webapp/src/games/kartroyale/collisions.mjs';

const edgeKey = (a,b) => [a.join(','),b.join(',')].sort().join('|');
const streets = new Set(WORLD.roads.filter(r=>!r.walk).map(r=>edgeKey(r.a,r.b)));
test('all six longer district circuits stay connected, near their landmarks, and clear of buildings',()=>{
  assert.equal(DISTRICT_ROUTES.length,6);
  for(const route of DISTRICT_ROUTES){
    const track=makeTrack(route.id);
    assert.ok(track.length > route.originalLength*1.35,route.id+' longer');
    assert.equal(new Set(route.points.map(p=>p.join(','))).size,route.points.length,'no repeated road nodes');
    route.points.forEach((p,i)=>assert.ok(streets.has(edgeKey(p,route.points[(i+1)%route.points.length])),route.id+' connected road'));
    for(const p of track.points)assert.ok(buildingClearance(p.x,p.z)>=p.width/2+TYRE_RADIUS+TYRE_EDGE_OFFSET,route.id+' tyre clearance');
    const id={skanderbeg:'square',stadium:'mother','lana-pyramid-grand':'pyramid'}[route.id]||route.id;
    const landmark=WORLD.landmarks.find(p=>p.id===id);
    assert.ok(Math.min(...track.points.map(p=>Math.hypot(p.x-landmark.x,p.z-landmark.z)))<(id==='lana'?320:180),route.id+' landmark');
    assert.ok(roadBumps(track).length>=3,route.id+' visible humps');
    assert.equal(track.points.length%4,0,'ordered quarter gates');
  }
});

const crossing=(speed=32)=>{
  const track=makeTrack('blloku'),bump=roadBumps(track)[0],r=createRacer(track,'you','You');
  const s=Math.sin(bump.yaw),c=Math.cos(bump.yaw);
  Object.assign(r,{x:bump.x-s*10,z:bump.z-c*10,index:bump.index,yaw:bump.yaw,velocityYaw:bump.yaw,speed});
  return {track,bump,r,s,c};
};
test('four tyres traverse the visible hump; faster crossings unload grip and settle',()=>{
  const peaks=[];
  for(const speed of [8,32]){
    const {track,bump,r,s,c}=crossing(speed);let height=0,impact=0,grip=1;
    for(let i=0;i<300;i++){
      const along=-10+speed*i*STEP;r.x=bump.x+s*along;r.z=bump.z+c*along;
      stepSuspension(r,track,STEP);
      height=Math.max(height,r.suspension.height);impact=Math.max(impact,r.bumpImpact);grip=Math.min(grip,r.suspension.grip);
      assert.ok(r.suspension.wheels.every(Number.isFinite));
    }
    assert.ok(height>.025);assert.ok(grip<.995&&grip>=.72);
    assert.ok(Math.abs(r.suspension.height)<.005,'damped settlement');peaks.push(impact);
    assert.ok(Math.abs(roadHeight([bump],bump.x,bump.z)-bump.height)<1e-8);
    assert.equal(roadHeight([bump],bump.x+s*bump.length,bump.z+c*bump.length),0);
  }
  assert.ok(peaks[1]>peaks[0]*1.5,'speed changes physical bump severity');
});

test('bumps affect driving momentum; recovery clears spring energy without granting race progress',()=>{
  const {track,r}=crossing(),flat=structuredClone(r),flatTrack={...track,roadFeelVersion:0};
  for(let i=0;i<45;i++){
    stepRacer(r,{throttle:true},track,STEP,i*STEP);
    stepRacer(flat,{throttle:true},flatTrack,STEP,i*STEP);
  }
  assert.ok(r.speed<flat.speed-.01,'hump changes physics, not only animation');
  const progress=[r.lap,r.gates,r.progress];
  stepRacer(r,{recover:true},track,STEP,10);
  assert.equal(r.suspension.height,0);assert.equal(r.suspension.velocity,0);
  assert.deepEqual([r.lap,r.gates,r.progress],progress);
});

test('same fixed inputs and serialized state reproduce suspension and collision results',()=>{
  const {track,r}=crossing(),a=[r,createRacer(track,'ai','AI',1,true)],b=structuredClone(a);
  for(let i=0;i<180;i++){
    a[0].input={throttle:true,steer:i<90?.12:-.12,drift:i<90,boost:i>=90};
    b[0].input={...a[0].input};
    stepRace(a,track,STEP,i*STEP,'pro');stepRace(b,track,STEP,i*STEP,'pro');
  }
  assert.deepEqual(a,b);
});

test('rivals choose an overtaking lane; off-axis crashes create bounded rotation',()=>{
  const {track,r}=crossing(),other=structuredClone(r);r.ai=true;
  Object.assign(other,{id:'other',speed:r.speed-5,x:r.x+Math.sin(r.yaw)*9,z:r.z+Math.cos(r.yaw)*9});
  const free=aiInput(r,track,0,'pro',[]),passing=aiInput(r,track,0,'pro',[r,other]);
  assert.ok(Math.abs(passing.aiLane)>Math.abs(free.aiLane)+.04,'opponent uses passing space');
  Object.assign(r,{x:0,z:0,yaw:0,velocityYaw:Math.PI/4,speed:24});
  Object.assign(other,{x:1.1,z:.4,yaw:0,velocityYaw:0,speed:4});
  resolveKartContact(r,other);
  assert.ok(Math.abs(r.collisionSpin)>0&&Math.abs(r.collisionSpin)<=.85);
  assert.ok(r.health>=50&&other.health>=50,'race remains recoverable');
});

async function tsModule(file){
  const root=new URL('../webapp/',import.meta.url);
  const result=await build({entryPoints:[new URL('src/games/kartroyale/'+file,root).pathname],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'three',setup(b){b.onResolve({filter:/^three$/},()=>({path:new URL('node_modules/three/build/three.module.js',root).href,external:true}));}}]});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
test('real Three.js hump meshes match contact heights and tyres use culled instance batches',async()=>{
  const {createRoadBumpLayer}=await tsModule('RoadBumpLayer.ts');
  const {createTyreBarrierLayer}=await tsModule('TyreBarrierLayer.ts');
  const track=makeTrack('blloku'),humps=createRoadBumpLayer(track),tyres=createTyreBarrierLayer(track),pos=humps.geometry.attributes.position;
  for(let i=0;i<pos.count;i+=11)assert.ok(Math.abs(pos.getY(i)-ROAD_SURFACE_Y-.006-roadHeight(roadBumps(track),pos.getX(i),pos.getZ(i)))<.001);
  assert.ok(tyres.children.length>8&&tyres.children.length<200);
  assert.ok(tyres.children.every(m=>m.isInstancedMesh&&m.frustumCulled&&m.boundingSphere.radius>0));
  for(const m of tyres.children){m.geometry.dispose();m.material.dispose();m.dispose();}humps.geometry.dispose();humps.material.dispose();
});
test('boost emits exhaust smoke, drifting emits tyre smoke, and the fixed pool fades out',async()=>{
  const {TyreSmoke}=await tsModule('tyreSmoke.ts'),smoke=new TyreSmoke();
  const {r}=crossing();r.boosting=true;r.braking=false;r.throttle=1;
  for(let i=0;i<8;i++)smoke.update(.1,[r]);
  const attributes=smoke.mesh.geometry.attributes;
  assert.ok([...attributes.opacity.array].some(n=>n>0));
  assert.ok([...attributes.exhaust.array].some(n=>n===1));
  r.boosting=false;r.drifting=true;
  for(let i=0;i<8;i++)smoke.update(.1,[r]);
  assert.ok([...attributes.opacity.array].some((n,i)=>n>0&&attributes.exhaust.array[i]===0));
  r.drifting=false;r.input={};r.turbo=0;
  for(let i=0;i<20;i++)smoke.update(.1,[r]);
  assert.ok([...attributes.opacity.array].every(n=>n===0));
  assert.equal(attributes.position.count,192);smoke.dispose();
});
