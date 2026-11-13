import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {CITY_BUILDING_DATA as DATA} from '../webapp/src/games/tirana-city-source/cityBuildingData.mjs';
import {CITY_BUILDING_CATALOG as CATALOG} from '../webapp/src/games/tirana-city-source/cityBuildingCatalog.mjs';
import {REFERENCE_BUILDINGS} from '../webapp/src/games/tirana-city-source/profiles.mjs';
import {CITY_PLACES,INSTITUTION_BUILDING_IDS} from '../webapp/src/games/tirana-city-source/registry.mjs';
import {buildings} from '../webapp/src/games/blackwater/shared/layout.mjs';
import {collides,rayBox} from '../webapp/src/games/blackwater/shared/physics.mjs';
const centre=ring=>[0,1].map(i=>ring.reduce((s,p)=>s+p[i],0)/ring.length);

test('new catalog has 25 matched sites and 34 separate buildings',()=>{
 assert.equal(Object.keys(CATALOG).length,25);assert.equal(DATA.buildings.length,34);
 for(const b of DATA.buildings){assert.ok(CATALOG[b.site]);assert.ok(b.tags.building);assert.ok(b.p.flat().every(Number.isFinite));assert.ok(b.heightBasis);}
 assert.equal(new Set(DATA.buildings.map(b=>b.id)).size,DATA.buildings.length);
});
test('Polytechnic is six building blocks, never a filled university campus',()=>{
 const b=DATA.buildings.filter(b=>b.site==='polytechnic');assert.equal(b.length,6);
 assert.ok(!b.some(b=>b.id==='410277121'));
 assert.equal(b.filter(b=>b.variant==='polytechnic-tower').length,1);
 assert.equal(b.find(b=>b.variant==='polytechnic-tower').h,23);
});
test('museum and academy share one building and the cathedral annex has no second dome',()=>{
 assert.equal(DATA.buildings.filter(b=>b.site==='archaeology').length,1);
 assert.match(CATALOG.archaeology.name,/Muzeu.*Albanologjia/);
 assert.equal(REFERENCE_BUILDINGS['469978009'].style,'orthodox-annex');
 assert.equal(REFERENCE_BUILDINGS['469978009'].height,12);
});
test('mapped court holes are open in collisions and vertical rays, with solid inner walls',()=>{
 for(const id of ['384505310','459085861']){
  const source=DATA.buildings.find(b=>b.id===id),obstacle=buildings.find(b=>b.id===id);
  assert.equal(obstacle.holes.length,source.holes.length);
  for(const hole of obstacle.holes){
   const [x,z]=centre(hole);
   assert.equal(collides(x,z,.1,[obstacle]),false,id);
   assert.equal(rayBox({x,y:100,z},{x:0,y:-1,z:0},obstacle),Infinity,id);
   assert.ok(Number.isFinite(rayBox({x,y:2,z},{x:1,y:0,z:0},obstacle)),id+' inner wall');
   const edge=hole[0];assert.equal(collides(edge[0],edge[1],.2,[obstacle]),true);
  }
  for(const replaced of source.replaces){assert.ok(INSTITUTION_BUILDING_IDS.has(replaced));assert.ok(!buildings.some(b=>b.id===replaced));}
 }
});
test('new public institutions have AL flags while worship and commerce do not inherit them',()=>{
 for(const b of DATA.buildings){
  const profile=REFERENCE_BUILDINGS[b.id],sites=CITY_PLACES.sites.filter(s=>s.buildingId===b.id);
  if(profile.flagCountry){assert.equal(sites.length,1,b.id);assert.equal(sites[0].country,'AL');}
  else for(const site of sites)assert.notEqual(site.country,'AL',b.id+' cannot inherit civic flag; verified diplomatic tenants retain theirs');
 }
});
test('new reference photos exist with attribution and dated historical states are disclosed',()=>{
 for(const site of Object.values(CATALOG))if(site.photo){
  assert.ok(existsSync(new URL('../webapp/public/assets/tirana-streets/references/'+site.photo,import.meta.url)));
  assert.ok(site.credit);assert.match(site.photoSource,/^https:/);assert.ok(site.date);
 }
 assert.match(CATALOG.gallery.features,/construction.*2026/);
 assert.match(CATALOG.xheko.features,/taller rear extension is not included/);
 assert.match(CATALOG.aba.features,/83 m.*81 m/);
});
