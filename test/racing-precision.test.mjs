import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.env.UPGRADE_ROOT||path.resolve(import.meta.dirname,'..');
const load=file=>import(pathToFileURL(path.join(root,'webapp/src/games/kartroyale',file)));
const sim=await load('legacySimulation.mjs');
const geometry=await load('grandRouteCore.mjs');
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
