import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNativeModel } from '../webapp/src/games/tirana-landmarks/nativeModels.mjs';
import { boulevardStorefronts, LAGUNA_BOULEVARD_ID, BAR_WEST_ID } from '../webapp/src/games/tirana-street-life/boulevardBusinesses.mjs';
import { buildStreetModel } from '../webapp/src/games/tirana-street-life/streetModels.mjs';

test('Pyramid colour rooms remain present on both model levels; small budget and no asset fetch',()=>{
 for(const lod of ['near','far']){
  const p=buildNativeModel('pyramid',lod);
  assert.equal(p.meshes.length,5);
  for(const color of ['coral','blue','gold']){
   const positions=p.meshes.find(m=>m.material===color).positions;
   assert.ok(positions.some((v,i)=>i%3===1&&v>19));
   assert.ok(positions.some((v,i)=>i%3===1&&v<5.5));
  }
  assert.ok(p.triangles<(lod==='near'?4400:1250),p.triangles);
 }
});

test('only the exact Laguna kiosk is restyled; Bar West mapped point resolves once',()=>{
 const exact={id:LAGUNA_BOULEVARD_ID,name:'Laguna',x:53.111,z:455.621,width:4.8};
 const other={...exact,id:'node/4464777460'};
 const sites=boulevardStorefronts([exact,other]);
 assert.deepEqual(sites[1],other);
 assert.notEqual(sites[0],exact);
 const west=sites[2];
 assert.equal(west.id,BAR_WEST_ID);
 assert.equal(west.buildingId,'295492165');
 assert.deepEqual(west.point,[65.413,529.661]);
 assert.ok(Math.hypot(west.x-west.point[0],west.z-west.point[1])<4);
 assert.equal(boulevardStorefronts(sites).length,3);
});

test('kiosk and terrace use distinct authentic silhouettes and the existing shared atlas',()=>{
 const [laguna,west]=boulevardStorefronts([{id:LAGUNA_BOULEVARD_ID,name:'Laguna',x:53.111,z:455.621,width:4.8}]);
 const kiosk=buildStreetModel(laguna,'storefront'), terrace=buildStreetModel(west,'storefront');
 assert.equal(kiosk.signs[0].text,'Laguna  ·  PIZZA & ICE CREAM');
 assert.equal(kiosk.parts.some(p=>p.shape==='glass'),true);
 assert.ok(kiosk.parts.every(p=>p.p[1]+p.s[1]/2<3.25));
 assert.equal(terrace.signs[0].text,'BAR WEST');
 assert.equal(terrace.parts.filter(p=>p.shape==='cone').length,2);
 for(const model of [kiosk,terrace]){
  assert.ok(model.parts.length<45);
  assert.ok(model.parts.every(p=>p.p.every(Number.isFinite)&&p.s.every(s=>s>0)));
 }
});
