import assert from 'node:assert/strict';
import test from 'node:test';
import clipping from 'polygon-clipping';
import {aliDemiPlaces,aliDemiSurfaces,ALI_DEMI_SOURCE} from '../webapp/src/games/tiranastreets-november/shared/aliDemiRecreation.mjs';
import {WORLD} from '../webapp/src/games/tiranastreets-november/shared/world.mjs';
import {findMapRoute,buildMapGraph,inBounds} from '../webapp/src/games/tiranastreets-november/map/mapCore.mjs';
import {insideRing} from '../webapp/src/games/tirana-environment/surfaceCore.mjs';

const {park, sportsCentre, skate, pitches} = aliDemiSurfaces(WORLD.origin);
const close = r => [...r, r[0]];
const area = r => Math.abs(r.reduce((sum, a, i)=>{
  const b=r[(i+1)%r.length];return sum+a[0]*b[1]-a[1]*b[0];
},0)/2);
const intersect = (a,b) => clipping.intersection([close(a)], [close(b)]).reduce((s,[r])=>s+area(r),0);

test('surveyed court surfaces are distinct and inside their correct boundaries', ()=>{
  assert.equal(pitches.length,2);
  assert.equal(pitches[0].length,4);assert.equal(pitches[1].length,4);
  assert.ok(area(park)>5000);
  assert.equal(pitches.filter(p=>Math.abs(intersect(sportsCentre,p)-area(p))<.001).length,2);
  assert.ok(Math.abs(intersect(park,skate)-area(skate))<.001);
  assert.ok(intersect(pitches[0],pitches[1])<.001);
  assert.ok(intersect(park,sportsCentre)<.001);
});

test('recreation map pins keep their distinct names and source IDs', ()=>{
  const places=aliDemiPlaces(WORLD.origin);
  assert.deepEqual(places.map(p=>p.name),['Parku Ali Demi','Kompleksi Sportiv Ali Demi','Ali Demi Skate Park']);
  assert.deepEqual(places.map(p=>p.id),['osm-way-248993659','osm-way-1123612794','osm-way-854194730']);
  assert.ok(places.every(p=>inBounds(p,WORLD.bounds)));
  const closeRings=[park,sportsCentre,skate];
  assert.ok(places.every((p,i)=>insideRing([p.x,p.z],closeRings[i])));
  assert.equal(ALI_DEMI_SOURCE.park.version,11);
});

test('park and sports complex are reachable on the real city walking graph', ()=>{
  const graph=buildMapGraph(WORLD,'walk');
  const places=aliDemiPlaces(WORLD.origin);
  const outside = {x:1370,z:8};
  for(const pin of places.slice(0,2)){
    const result=findMapRoute(graph,outside,pin);
    assert.equal(result.reachable,true,result.message);
    assert.ok(result.accessDistance<55);
  }
});

test('the stage 2 grass clipper preserves the park without covering the skate deck and courts', async ()=>{
  const {clipParkSurfaces}=await import('../webapp/src/games/tirana-environment/parkClip.mjs');
  const {roadCorridor}=await import('../webapp/src/games/tirana-environment/surfaceCore.mjs');
  const cuts=[...WORLD.areas,skate,...pitches,...WORLD.buildings.map(b=>b.p),
    ...WORLD.roads.map(r=>roadCorridor(r,r.walk?.2:2.5)).filter(Boolean)];
  const result=clipParkSurfaces([park],cuts);
  assert.deepEqual(result.failures,[]);
  assert.ok(result.polygons.length>0);
  const green=result.polygons.reduce((sum,[outer,...holes])=>sum+area(outer)-holes.reduce((s,r)=>s+area(r),0),0);
  assert.ok(green>2000 && green<area(park)-area(skate)+.001);
  const skateOverlap=result.polygons.flatMap(poly=>clipping.intersection(poly,[close(skate)]))
    .reduce((sum,[outer,...holes])=>sum+area(outer)-holes.reduce((s,p)=>s+area(p),0),0);
  assert.ok(skateOverlap<.01,'concrete skate deck must not be landscaped as grass');
  console.log('verified park area m²',Math.round(area(park)),'clipped grass area m²',Math.round(green),
    'soccer pitches m²',pitches.map(p=>Math.round(area(p))));
});
