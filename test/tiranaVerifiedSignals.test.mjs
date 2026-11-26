import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SIGNALS,VERIFIED_SIGNALS,SOLO_SIGNAL_FIXTURES,phaseForSoloSignal,onCarriageway,signalPhase} from '../webapp/src/games/tiranastreets-november/shared/streetLayout.mjs';
import {redSignalGap} from '../webapp/src/games/tiranastreets-november/shared/trafficSimulation.mjs';
import {OSM_SIGNAL_NODES,FIXTURE_SOURCES} from '../webapp/src/games/tiranastreets-november/shared/verifiedStreetFixtureData.mjs';

test('source-tagged controls resolve on major Tirana streets without shifting centreline anchors',()=>{
 const sources=new Map(OSM_SIGNAL_NODES.map(row=>['node/'+row[0],row]));
 assert.ok(FIXTURE_SOURCES.every(s=>s.sha256.length===64));
 assert.ok(VERIFIED_SIGNALS.length>=20);
 assert.ok(VERIFIED_SIGNALS.filter(s=>s.name==='Rruga Ali Demi').length>=3);
 assert.ok(VERIFIED_SIGNALS.some(s=>s.name==='Rruga Dritan Hoxha'));
 assert.ok(VERIFIED_SIGNALS.some(s=>s.name==='Rruga Xhanfize Keko'));
 for(const s of VERIFIED_SIGNALS){
  const [,v,x,z,tags]=sources.get(s.id);
  assert.deepEqual([s.version,s.x,s.z,s.tags],[v,x,z,tags]);
  assert.match(tags['traffic_signals:direction'],/^(forward|backward)$/);
  assert.equal(onCarriageway(s.poleX,s.poleZ,.28),false);
 }
});
test('every solo fixture shares the braking clock and appears exactly once',()=>{
 assert.equal(SOLO_SIGNAL_FIXTURES.length,new Set(SOLO_SIGNAL_FIXTURES.map(s=>s.id)).size);
 assert.equal(SOLO_SIGNAL_FIXTURES.length,SIGNALS.length);
 assert.equal(phaseForSoloSignal('unsupported-osm-fixture',0),null);
 for(const p of SOLO_SIGNAL_FIXTURES){
  const s=SIGNALS.find(s=>s.id===p.id);
  for(const t of [0,9.25,10.95,12.72,23.1,24,31.9,62.7]){
   assert.equal(phaseForSoloSignal(p.id,t),signalPhase(s,t));
  }
 }
});
test('a verified approach brakes on the rendered red phase and releases at green',()=>{
 const s=VERIFIED_SIGNALS.find(s=>s.id==='node/1841668967');
 assert.ok(s,'mapped Ali Demi directional control missing');
 const car={x:s.x+Math.sin(s.yaw)*8,z:s.z+Math.cos(s.yaw)*8,heading:s.yaw,model:'sedan'};
 const timeAt=local=>local-s.junction*1.7;
 const red=timeAt(26),green=timeAt((s.axis===0?0:12)+2);
 assert.equal(phaseForSoloSignal(s.id,red),'red');
 assert.ok(Number.isFinite(redSignalGap(car,red)));
 assert.equal(phaseForSoloSignal(s.id,green),'green');
 assert.equal(redSignalGap(car,green),Infinity);
});
