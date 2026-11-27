import test from 'node:test';
import assert from 'node:assert/strict';
import {kodraRoadFinish,kodraPlasterWall,KODRA_PRIFTIT_VIEW} from '../webapp/src/games/tirana-neighbourhood/kodraPriftit.mjs';
import {corridorRoadMaterialId} from '../webapp/src/games/tirana-neighbourhood/streetCorridorMaterial.mjs';
import {districtFinish} from '../webapp/src/games/tirana-neighbourhood/districtBuildingPalette.mjs';
const named=(name,way,surface)=>({name,way,tags:{surface},a:[2810,-1010],b:[2825,-1040],w:6.2});
test('only exact Kodra source roads receive tag-specific treatment; geometry remains unchanged',()=>{
 for(const r of [named('Rruga Disha','184324924','asphalt'),named('Rruga Disha','1484033050','asphalt'),
   named('Rruga Seit Gega','184324915','asphalt'),named('Rruga Vilson Blloshmi','184330307','asphalt')]){
  const before=structuredClone(r);
  assert.equal(kodraRoadFinish(r),16);assert.equal(corridorRoadMaterialId(r),16);
  assert.deepEqual(r,before);assert.equal(kodraRoadFinish({...r,bridge:true}),0);
  assert.equal(kodraRoadFinish({...r,tags:{}}),0);
 }
 assert.equal(corridorRoadMaterialId(named('Rruga Disha','45029584','compacted')),17);
 assert.equal(corridorRoadMaterialId(named('Rruga Disha','11111111','asphalt')),0);
 assert.equal(corridorRoadMaterialId(named('Rruga Disha e Re','184324924','asphalt')),0);
 assert.equal(corridorRoadMaterialId(named(undefined,undefined,'asphalt')),0);
});
test('bounded locale tint preserves explicit source/roof material and unrelated buildings',()=>{
 const {x,z}=KODRA_PRIFTIT_VIEW,b={h:3.2,id:'test-house',p:[[x-3,z-4],[x+3,z-4],[x+3,z+4],[x-3,z+4]],tags:{building:'yes'}};
 assert.equal(kodraPlasterWall(b),true);
 assert.equal(districtFinish(b.p,b.id).zone,'kodra-priftit');
 for(const tags of [{building:'church'},{building:'shed'},{building:'yes','building:material':'brick'},{building:'yes','building:colour':'#fff'},{building:'yes',historic:'yes'}])
  assert.equal(kodraPlasterWall({...b,tags}),false);
 assert.equal(kodraPlasterWall({...b,h:28}),false);
 assert.equal(kodraPlasterWall({...b,p:b.p.map(([x,z])=>[x+1800,z])}),false);
});
