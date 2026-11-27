import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEIGHBOURHOOD } from '../webapp/src/games/tirana-neighbourhood/data.mjs';
import { corridorMaterialId } from '../webapp/src/games/tirana-neighbourhood/streetCorridorMaterial.mjs';
import { petroTodiBlockFacades, petroTodiBlockParts } from '../webapp/src/games/tirana-tabakeve/petroTodiBlocks.mjs';
test('locally authored facade trim attaches to four retained OSM footprints', () => {
 const expected={'620369881':9,'736721581':10,'682723386':11,'548100908':9};
 const blocks=petroTodiBlockFacades(NEIGHBOURHOOD.buildings);
 assert.equal(blocks.length,4);
 for(const b of blocks) {
  assert.equal(b.levels,expected[b.id]);
  assert.equal(b.h,NEIGHBOURHOOD.buildings.find(s=>s.id===b.id).h);
  const parts=petroTodiBlockParts(b);
  assert.equal(parts.length,(b.levels-1)*3+1);
  for(const p of parts){
   const e=b.edge,dx=p.x-e.a[0],dz=p.z-e.a[1],along=dx*e.ux+dz*e.uz,offset=dx*e.nx+dz*e.nz;
   assert.ok(along-p.w/2>0&&along+p.w/2<e.length);
   assert.ok(offset-p.d/2>0&&offset+p.d/2<.25);
   assert.ok(p.y-p.h/2>0&&p.y+p.h/2<b.h);
  }
 }
 assert.deepEqual(petroTodiBlockFacades([]),[]);
 assert.ok(!petroTodiBlockFacades(NEIGHBOURHOOD.buildings.map(b=>b.id==='620369881'?{...b,tags:{'building:levels':10}}:b)).some(b=>b.id==='620369881'));
});
test('named Todi Shkurti segments receive a separate treatment, not neighboring roads', () => {
 const segments=NEIGHBOURHOOD.roads.filter(r=>r.name==='Rruga Todi Shkurti');
 assert.ok(segments.length>=100);
 assert.ok(segments.every(r=>corridorMaterialId(r.name)===8));
 assert.notEqual(corridorMaterialId('Rruga Petro Nini Luarasi'),8);
 assert.equal(corridorMaterialId('Rruga Todi Shkurti (service road)'),0);
});
