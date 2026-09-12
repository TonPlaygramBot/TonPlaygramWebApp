import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCAL_LIFE} from '../webapp/src/games/tirana-environment/localLifeData.mjs';
import {MAPPED_PARKS,LOCAL_FUEL,amenityAnchor} from '../webapp/src/games/tirana-environment/mappedAmenitiesCore.mjs';
import {roofClearance} from '../webapp/src/games/tirana-city-source/housingCore.mjs';

test('municipal-reference amenities retain actual OSM source identity and coordinates',()=>{
  assert.equal(LOCAL_LIFE.sites.filter(s=>s.category==='fuel').length,106);
  assert.equal(MAPPED_PARKS.filter(s=>s.category==='park').length,242);
  assert.equal(MAPPED_PARKS.filter(s=>s.category==='playground').length,116);
  assert.equal(LOCAL_FUEL.length,101);
  assert.equal(new Set(LOCAL_LIFE.sites.map(s=>s.id)).size,LOCAL_LIFE.sites.length);
  for(const s of LOCAL_LIFE.sites){assert.ok(Number.isFinite(s.x+s.z));assert.match(s.source,/openstreetmap.org\/(node|way)\//);}
});
test('furniture is bounded by mapped polygons; point features get no invented area',()=>{
  let parks=0,playgrounds=0;
  for(const s of MAPPED_PARKS){
    if(!s.ring){assert.equal(s.furnishingAnchor,undefined);continue;}
    if(!s.furnishingAnchor)continue;
    const p=s.furnishingAnchor,c=s.category==='playground'?3.1:1.2;
    assert.ok(roofClearance(p.x,p.z,s.ring)>=c-1e-6,s.id);
    if(s.category==='playground')playgrounds++;else parks++;
  }
  assert.equal(parks,227);assert.equal(playgrounds,74);
});
test('placement rejects point-only and tiny polygons and respects concave edges',()=>{
  assert.equal(amenityAnchor({x:0,z:0}),null);
  assert.equal(amenityAnchor({x:0,z:0,ring:[[0,0],[2,0],[2,2],[0,2],[0,0]]},3.1),null);
  const s={x:8,z:8,ring:[[0,0],[20,0],[20,5],[5,5],[5,20],[0,20],[0,0]]},p=amenityAnchor(s,1.2);
  assert.ok(p);assert.ok(roofClearance(p.x,p.z,s.ring)>=1.2);
});
