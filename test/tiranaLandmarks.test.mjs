import test from 'node:test';
import assert from 'node:assert/strict';
import {LANDMARK_DATA} from '../webapp/src/games/tirana-city-source/landmarkData.mjs';
import {LANDMARK_CATALOG,LANDMARK_REPLACED_IDS,landmarkBuildings} from '../webapp/src/games/tirana-city-source/landmarkCatalog.mjs';
import {REFERENCE_BUILDINGS} from '../webapp/src/games/tirana-city-source/profiles.mjs';
import {CITY_PLACES} from '../webapp/src/games/tirana-city-source/registry.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets/shared/world.mjs';
import {polygonContains} from '../webapp/src/games/tiranastreets/shared/architecture.mjs';

test('every requested site has real building geometry, finite positions and a visual reference',()=>{
 for(const [id,site] of Object.entries(LANDMARK_CATALOG)){
  assert.match(site.source,/^https:\/\//);const buildings=LANDMARK_DATA.buildings.filter(b=>b.site===id);assert.ok(buildings.length,id);
  for(const b of buildings){assert.ok(b.tags.building);assert.ok(b.p.length>=3);assert.ok(b.p.flat().every(Number.isFinite));assert.ok(b.h>0);assert.ok(REFERENCE_BUILDINGS[b.id]);}
 }
 assert.equal(new Set(LANDMARK_DATA.buildings.map(b=>b.id)).size,LANDMARK_DATA.buildings.length);
});
test('Grand is the confirmed Ali Visha building at ish-Tregu Elektrik',()=>{
 const b=LANDMARK_DATA.buildings.find(b=>b.site==='grand');assert.equal(b.id,'548100908');assert.equal(b.tags['addr:street'],'Rruga Ali Visha');assert.equal(b.tags['building:levels'],'9');
});
test('campus boundaries are never extruded as a single building',()=>{
 assert.ok(!LANDMARK_REPLACED_IDS.has('234270352'));assert.ok(!LANDMARK_REPLACED_IDS.has('1512253126'));
 const dorms=LANDMARK_DATA.buildings.filter(b=>b.site==='studenti');assert.ok(dorms.length>=18);assert.ok(dorms.every(b=>b.tags.building==='dormitory'));
 assert.equal(LANDMARK_DATA.buildings.filter(b=>b.site==='mangalem').length,6);
});
test('stadium retains the inner opening and separate tall Marriott tower',()=>{
 const bowl=LANDMARK_DATA.buildings.find(b=>b.id==='relation/10311002');assert.equal(bowl.holes.length,1);assert.ok(bowl.holes[0].length>=4);
 assert.ok(LANDMARK_REPLACED_IDS.has('746635211'));assert.ok(LANDMARK_REPLACED_IDS.has('746635210'));
 assert.equal(LANDMARK_DATA.buildings.find(b=>b.id==='795642504').h,112);
});
test('Taivani fountain uses its mapped pond and three jet nodes',()=>{
 const f=LANDMARK_DATA.fountain;assert.equal(f.id,'way/233519336');assert.equal(f.jets.length,3);
 for(const jet of f.jets)assert.ok(polygonContains(jet.p[0],jet.p[1],f.p));
 assert.ok(Math.abs(f.jets[0].p[1]-277.45)>50,'not the old arbitrary Rinia centre');
});
test('in-map model walls retain the exact collision footprints',()=>{
 const all=landmarkBuildings(WORLD);assert.equal(new Set(all.map(b=>b.id)).size,all.length);
 for(const b of WORLD.buildings)assert.deepEqual(all.find(a=>a.id===b.id).p,b.p);
});
test('TEG and QTU stay at their real regional coordinates',()=>{
 for(const site of ['teg','qtu']){
  const b=LANDMARK_DATA.buildings.find(b=>b.site===site),x=b.p.reduce((s,p)=>s+p[0],0)/b.p.length,z=b.p.reduce((s,p)=>s+p[1],0)/b.p.length;
  assert.ok(Math.hypot(x,z)>4000);assert.ok(x<WORLD.bounds[0]||x>WORLD.bounds[2]||z<WORLD.bounds[1]||z>WORLD.bounds[3]);
 }
});
test('commercial and residential profiles cannot acquire civic flags',()=>{
 for(const b of LANDMARK_DATA.buildings){
  if(!['mall','residential'].includes(REFERENCE_BUILDINGS[b.id].category))continue;
  for(const site of CITY_PLACES.sites.filter(s=>s.buildingId===b.id))assert.equal(site.country,null);
 }
});
