import test from 'node:test';
import assert from 'node:assert/strict';
import {PALETTES, canStyleBuilding, districtFinish} from '../webapp/src/games/tirana-neighbourhood/districtBuildingPalette.mjs';
test('all mapped anchors select their local palette at its strongest strength',()=>{
 for(const [zone,x,z,,colors] of PALETTES) {
  const choice=districtFinish([[x-1,z],[x+1,z]],'373113');
  assert.equal(choice.zone,zone);
  assert.equal(choice.strength,1);
  assert.ok(colors.includes(choice.color));
 }
});
test('outer city retains bounded styled fallbacks across all four extents',()=>{
 for(const [zone,x,z] of [['west',-4990,-10],['east',3590,1150],['south',0,3090],['north',0,-3490]]) {
  const choice=districtFinish([[x,z]],'193123');
  assert.equal(choice.zone,zone);
  assert.equal(choice.strength,.32);
 }
 assert.equal(districtFinish([],'missing').strength,0);
});
test('measured finishes, civic and construction surfaces are not overridden',()=>{
 for(const tags of [{'building:colour':'#c00'},{'building:material':'brick'}, {historic:'yes'}, {military:'yes'},
  {building:'mosque'}, {building:'industrial'}, {building:'construction'}, {amenity:'school'}]) {
  assert.equal(canStyleBuilding({tags}),false);
 }
 assert.equal(canStyleBuilding({special:'landmark'}),false);
 assert.equal(canStyleBuilding({tags:{building:'apartments'}}),true);
});
test('same mapped footprint keeps stable facade, with five variants in a zone',()=>{
 const footprint=[[-350,814],[-320,815],[-320,845],[-350,845]];
 assert.deepEqual(districtFinish(footprint,3),districtFinish(footprint,3));
 const samples=new Set(Array.from({length:60},(_,id)=>districtFinish(footprint,id).color));
 assert.equal(samples.size,5);
});
