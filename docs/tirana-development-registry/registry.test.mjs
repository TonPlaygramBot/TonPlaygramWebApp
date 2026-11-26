import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const registry=JSON.parse(readFileSync(new URL('./registry.json',import.meta.url)));
const expected=new Set(['built','observed_construction','conditionally_approved','agenda_only']);
test('separates each evidence stage and keeps unique neutral IDs',()=>{
 assert.equal(registry.schemaVersion,1);
 assert.deepEqual(new Set(registry.records.map(r=>r.stage)),expected);
 assert.equal(new Set(registry.records.map(r=>r.id)).size,registry.records.length);
});
test('unresolved coordinates and dates cannot become map geometry or observation claims',()=>{
 for(const r of registry.records){
  assert.equal(r.location.coordinates,null);
  assert.equal(r.location.crs,null);
  assert.ok(r.sources.length&&r.limitations.length);
  assert.ok(!('asset' in r)&&!('geometry' in r));
  if(r.stage==='built')assert.ok(r.sources.some(s=>s.kind==='official_existing_feature'));
  if(r.stage==='observed_construction'){
   assert.equal(r.stageDate,null);
   assert.equal(r.location.cadastralZone,'8310');
   assert.equal(r.location.parcels.length,9);
   assert.ok(r.sources.some(s=>s.kind==='official_construction_documentation'));
  }
  if(r.stage==='conditionally_approved'){
   assert.equal(r.legalStatus,'conditional_approval');
   assert.ok(r.location.parcel&&r.sources.some(s=>s.kind==='signed_decision'));
  }
  if(r.stage==='agenda_only'){
   assert.equal(r.legalStatus,'unverified_outcome');
   assert.ok(!r.approvedDesign&&r.proposedDesign);
   assert.ok(r.sources.every(s=>s.kind==='meeting_agenda'));
  }
 }
});
