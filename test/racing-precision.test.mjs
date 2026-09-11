import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.UPGRADE_ROOT||path.resolve(import.meta.dirname,'..');
const load=file=>import(pathToFileURL(path.join(root,'webapp/src/games/kartroyale',file)));
const sim=await load('legacySimulation.mjs');
const geometry=await load('grandRouteCore.mjs');
const edges=await load('trackEdges.mjs');
const {buildRaceCatalog}=await load('raceCatalog.mjs');
const {TIRANA_ROUTES}=await load('tirana-routes.mjs');
function rectangle(counts){
  const corners=[[0,0],[100,0],[100,100],[0,100]],points=[];
  for(let i=0;i<4;i++)for(let j=0;j<counts[i];j++){
    const [x,z]=corners[i],[tx,tz]=corners[(i+1)%4];points.push({x:x+(tx-x)*j/counts[i],z:z+(tz-z)*j/counts[i],yaw:Math.atan2(tx-x,tz-z)});
  }return {points,length:400,width:12};
}
test('AI steering follows metres rather than unequal point density',()=>{
  const r={x:85,z:0,yaw:Math.PI/2,speed:30,slot:0,boost:100};
  const a=sim.aiInput(r,rectangle([90,90,90,90]),0),b=sim.aiInput(r,rectangle([30,150,90,90]),0);
  assert.ok(Math.abs(a.steer-b.steer)<1e-9,`${a.steer} vs ${b.steer}`);
});
for(const count of [3,4,5,6,7])test(`valid ${count}-sample route does not use negative array indices`,()=>{
  const result=geometry.resampleCircuit([[0,0],[60,0],[0,60]],count);
  assert.equal(result.points.length,count);assert.ok(Number.isFinite(result.length));
});
for(const route of TIRANA_ROUTES)test(`${route.id}: exact centreline corners and 360-point contract remain`,()=>{
  const result=geometry.resampleCircuit(route.points,360);assert.equal(result.points.length,360);
  assert.ok(Math.abs(result.length-geometry.routeLength(route.points))<1e-6);
  for(const [x,z] of route.points)assert.ok(result.points.some(p=>Math.hypot(p.x-x,p.z-z)<1e-6));
});
test('the six-circuit catalog remains intact; unvalidated Grand routes stay rejected',()=>{
  const catalog=buildRaceCatalog(sim,TIRANA_ROUTES);assert.equal(catalog.tracks.length,6);assert.equal(catalog.diagnostics.length,0);
  assert.throws(()=>catalog.makeTrack('skanderbeg-grand'),/unvalidated/);
});
test('invalid circuit coordinates remain rejected',()=>{
  for(const raw of [[],[[0,0],[1,0],[NaN,3]],[[0,0],[0,0],[0,0]]])assert.throws(()=>geometry.resampleCircuit(raw));
});
for(const route of TIRANA_ROUTES)test(`${route.id}: rendered sides stay exactly parallel and equidistant`,()=>{
  const track=sim.makeTrack(route.id);
  for(let i=0;i<track.points.length;i++){
    const a=track.points[i],b=track.points[(i+1)%track.points.length],f=edges.segmentFrame(a,b,track.width/2),left=f.side(-1),right=f.side(1);
    assert.ok(Math.abs(Math.hypot(left.x-f.x,left.z-f.z)-track.width/2)<1e-9);
    assert.ok(Math.abs(Math.hypot(right.x-f.x,right.z-f.z)-track.width/2)<1e-9);
    assert.ok(Math.abs((right.x-left.x)*f.tx+(right.z-left.z)*f.tz)<1e-9);
    assert.ok(Math.abs((left.x+right.x)/2-f.x)<1e-9&&Math.abs((left.z+right.z)/2-f.z)<1e-9);
  }
});
test('ten vehicle classes expose distinct race parameters',()=>{
  assert.equal(sim.KARTS.length,10);
  assert.equal(new Set(sim.KARTS.map(k=>`${k.speed}/${k.handling}/${k.brake}/${k.shield}/${k.ammunition}`)).size,10);
});
test('shield absorbs impacts and missiles consume finite ammunition',()=>{
  const track=sim.makeTrack('skanderbeg'), shooter=sim.createRacer(track,'a','A',0), target=sim.createRacer(track,'b','B',1);
  shooter.x=0; shooter.z=0; shooter.yaw=0; shooter.ammunition=2; shooter.input.fire=true;
  target.x=0; target.z=12; target.shieldActive=true; target.input.shield=true;
  const health=target.health;
  sim.stepRace([shooter,target],track,sim.STEP,1);
  assert.equal(shooter.ammunition,1); assert.equal(shooter.missileHits,1);
  assert.ok(target.health>health-5); assert.ok(target.shield<target.shieldMax);
});
